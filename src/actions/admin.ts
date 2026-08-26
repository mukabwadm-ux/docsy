'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { assertAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSignedDownloadUrl, describeExpiry } from '@/lib/delivery'
import { EMAIL_SETUP_HINT, isEmailConfigured, sendDeliveryEmail } from '@/lib/email'
import { fileTypeLabel } from '@/lib/format'
import { one, slugify } from '@/lib/utils'

export interface ActionState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
  /** Set by delivery actions so the admin can copy the link. */
  url?: string
}

const DENIED: ActionState = {
  status: 'error',
  message: 'You are not signed in as an admin.',
}

/**
 * Refreshes every public surface a product can appear on.
 *
 * The storefront is statically rendered with a 60s ISR window, so without this
 * an edit made in the admin panel appears to have done nothing for up to a
 * minute — which reads as a broken save and invites the admin to submit again.
 */
function revalidateStorefront(slug?: string) {
  revalidatePath('/')
  revalidatePath('/products')
  if (slug) revalidatePath(`/products/${slug}`)
}

// ============================================================ file uploads

const UPLOAD_BUCKETS = {
  image: 'product-images',
  file: 'digital-products',
} as const

/**
 * Mints a short-lived signed upload URL so the browser can send the file
 * straight to Supabase Storage.
 *
 * Files do NOT travel through a Server Action. Server Actions cap the request
 * body at 1 MB by default, and raising that ceiling to accommodate a 300 MB ZIP
 * would route the whole payload through the Next server, burning memory and
 * hitting platform request limits on any host. A direct-to-storage upload keeps
 * the file off our compute entirely.
 *
 * The admin check happens here, at URL-issuing time. The signed URL that comes
 * back is single-use and scoped to one path.
 */
export async function createUploadUrl(
  kind: 'image' | 'file',
  fileName: string
): Promise<{ path: string; token: string; bucket: string } | { error: string }> {
  const session = await assertAdmin()
  if (!session) return { error: 'Not authorised.' }

  const bucket = UPLOAD_BUCKETS[kind]
  if (!bucket) return { error: 'Unknown upload type.' }

  // Strip anything that could escape the intended prefix or confuse Storage.
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-120)

  // A random prefix keeps two uploads of "cover.jpg" from overwriting one
  // another, without needing to know the product id before the file exists.
  const prefix = crypto.randomUUID().slice(0, 8)
  const path = `${prefix}/${safe || 'upload'}`

  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUploadUrl(path)

  if (error || !data) return { error: error?.message ?? 'Could not start the upload.' }

  return { path: data.path, token: data.token, bucket }
}

/** Public URL for something already in the public images bucket. */
export async function publicImageUrl(path: string): Promise<string> {
  const { data } = createAdminClient().storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

// =============================================================== products

const jsonArray = <T>(fallback: T[]) =>
  z
    .string()
    .optional()
    .transform((raw): T[] => {
      if (!raw?.trim()) return fallback
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as T[]) : fallback
      } catch {
        // The field is machine-written by our own form. A parse failure means
        // something is wrong with the client, not with the admin's typing, so
        // falling back beats failing the whole save and losing their work.
        return fallback
      }
    })

const productSchema = z.object({
  title: z.string().trim().min(3, 'Give the product a title.').max(160),
  slug: z.string().trim().max(90).optional(),
  short_description: z.string().trim().max(300).optional(),
  description: z.string().trim().max(20000).optional(),
  announcement_text: z.string().trim().max(160).optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative.').max(100000),
  compare_at_price: z
    .union([z.coerce.number().min(0).max(100000), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  currency: z.string().trim().length(3).default('USD'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  file_url: z.string().trim().max(400).optional(),
  file_type: z.string().trim().max(24).optional(),
  file_size_mb: z
    .union([z.coerce.number().min(0), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  preview_image_url: z.string().trim().max(600).optional(),
  is_featured: z.coerce.boolean().default(false),
  status: z.enum(['active', 'draft', 'archived']).default('draft'),
  benefits: z
    .string()
    .optional()
    .transform((raw) =>
      (raw ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 12)
    ),
  story_content: jsonArray<Record<string, unknown>>([]),
  how_it_works: jsonArray<Record<string, unknown>>([]),
  gallery: jsonArray<string>([]),
})

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug') || undefined,
    short_description: formData.get('short_description') || undefined,
    description: formData.get('description') || undefined,
    announcement_text: formData.get('announcement_text') || undefined,
    price: formData.get('price'),
    compare_at_price: formData.get('compare_at_price') ?? '',
    currency: formData.get('currency') || 'USD',
    category_id: formData.get('category_id') || '',
    file_url: formData.get('file_url') || undefined,
    file_type: formData.get('file_type') || undefined,
    file_size_mb: formData.get('file_size_mb') ?? '',
    preview_image_url: formData.get('preview_image_url') || undefined,
    is_featured: formData.get('is_featured') === 'on',
    status: formData.get('status') || 'draft',
    benefits: formData.get('benefits') || undefined,
    story_content: formData.get('story_content') || undefined,
    how_it_works: formData.get('how_it_works') || undefined,
    gallery: formData.get('gallery') || undefined,
  })
}

function toRow(data: z.infer<typeof productSchema>) {
  return {
    title: data.title,
    slug: data.slug?.trim() ? slugify(data.slug) : slugify(data.title),
    short_description: data.short_description ?? null,
    description: data.description ?? null,
    announcement_text: data.announcement_text ?? null,
    price: data.price,
    compare_at_price: data.compare_at_price,
    currency: data.currency.toUpperCase(),
    category_id: data.category_id || null,
    file_url: data.file_url ?? null,
    file_type: data.file_type?.toLowerCase() ?? null,
    file_size_mb: data.file_size_mb,
    preview_image_url: data.preview_image_url ?? null,
    is_featured: data.is_featured,
    status: data.status,
    benefits: data.benefits,
    story_content: data.story_content,
    how_it_works: data.how_it_works,
  }
}

function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

/** Replaces the gallery rows for a product. */
async function syncGallery(productId: string, urls: string[], title: string) {
  const db = createAdminClient()
  await db.from('product_images').delete().eq('product_id', productId)
  if (urls.length === 0) return

  await db.from('product_images').insert(
    urls.slice(0, 8).map((image_url, i) => ({
      product_id: productId,
      image_url,
      alt_text: i === 0 ? title : `${title} — view ${i + 1}`,
      sort_order: i,
    }))
  )
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const parsed = parseProduct(formData)
  if (!parsed.success) {
    return { status: 'error', fieldErrors: firstErrors(parsed.error), message: 'Check the fields below.' }
  }

  const row = toRow(parsed.data)
  const { data, error } = await createAdminClient()
    .from('products')
    .insert(row)
    .select('id, slug')
    .single()

  if (error) {
    // 23505 is unique_violation, and `slug` is the only unique column here.
    const message =
      error.code === '23505'
        ? 'A product with that URL slug already exists — try a different one.'
        : error.message
    return { status: 'error', message }
  }

  await syncGallery(data.id, parsed.data.gallery, row.title)
  revalidateStorefront(data.slug)
  redirect(`/admin/products/${data.id}?created=1`)
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const id = String(formData.get('id') ?? '')
  if (!id) return { status: 'error', message: 'Missing product id.' }

  const parsed = parseProduct(formData)
  if (!parsed.success) {
    return { status: 'error', fieldErrors: firstErrors(parsed.error), message: 'Check the fields below.' }
  }

  const row = toRow(parsed.data)
  const db = createAdminClient()

  // The old slug has its own cached page; revalidating only the new one would
  // leave the previous URL serving a stale copy of the product.
  const { data: before } = await db.from('products').select('slug').eq('id', id).maybeSingle()

  const { error } = await db.from('products').update(row).eq('id', id)
  if (error) {
    const message =
      error.code === '23505'
        ? 'A product with that URL slug already exists — try a different one.'
        : error.message
    return { status: 'error', message }
  }

  await syncGallery(id, parsed.data.gallery, row.title)
  revalidateStorefront(row.slug)
  if (before?.slug && before.slug !== row.slug) revalidateStorefront(before.slug)
  revalidatePath(`/admin/products/${id}`)

  return { status: 'success', message: 'Saved.' }
}

export async function setProductStatus(
  id: string,
  status: 'active' | 'draft' | 'archived'
): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const db = createAdminClient()
  const { data, error } = await db
    .from('products')
    .update({ status })
    .eq('id', id)
    .select('slug')
    .maybeSingle()

  if (error) return { status: 'error', message: error.message }

  revalidateStorefront(data?.slug)
  revalidatePath('/admin/products')
  return { status: 'success', message: `Product is now ${status}.` }
}

export async function deleteProduct(id: string): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const db = createAdminClient()
  const { data } = await db.from('products').select('slug').eq('id', id).maybeSingle()

  const { error } = await db.from('products').delete().eq('id', id)
  if (error) {
    return {
      status: 'error',
      // Orders reference products with ON DELETE SET NULL, so this is unlikely,
      // but a surviving FK must not surface as a blank screen.
      message: `Could not delete: ${error.message}`,
    }
  }

  revalidateStorefront(data?.slug)
  revalidatePath('/admin/products')
  return { status: 'success', message: 'Product deleted.' }
}

// ============================================================= categories

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Give the category a name.').max(60),
  slug: z.string().trim().max(70).optional(),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(40).optional(),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
})

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug') || undefined,
    description: formData.get('description') || undefined,
    icon: formData.get('icon') || undefined,
    sort_order: formData.get('sort_order') || 0,
  })
  if (!parsed.success) {
    return { status: 'error', fieldErrors: firstErrors(parsed.error) }
  }

  const { error } = await createAdminClient()
    .from('categories')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug?.trim() ? slugify(parsed.data.slug) : slugify(parsed.data.name),
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? null,
      sort_order: parsed.data.sort_order,
    })

  if (error) {
    return {
      status: 'error',
      message:
        error.code === '23505' ? 'That category slug is already taken.' : error.message,
    }
  }

  revalidateStorefront()
  revalidatePath('/admin/categories')
  return { status: 'success', message: 'Category added.' }
}

export async function deleteCategory(id: string): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  // products.category_id is ON DELETE SET NULL, so products survive and simply
  // become uncategorised rather than disappearing with the category.
  const { error } = await createAdminClient().from('categories').delete().eq('id', id)
  if (error) return { status: 'error', message: error.message }

  revalidateStorefront()
  revalidatePath('/admin/categories')
  return { status: 'success', message: 'Category deleted.' }
}

// ================================================================ reviews

export async function setReviewStatus(
  id: string,
  status: 'approved' | 'rejected' | 'pending'
): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const db = createAdminClient()
  const { data, error } = await db
    .from('reviews')
    .update({ status })
    .eq('id', id)
    .select('product_id, products ( slug )')
    .maybeSingle()

  if (error) return { status: 'error', message: error.message }

  // The rating trigger has just moved the product's average, so its page and
  // every grid showing its stars are now stale.
  const slug = one<{ slug?: string }>((data as { products?: unknown } | null)?.products as never)?.slug
  revalidateStorefront(slug)
  revalidatePath('/admin/reviews')
  return { status: 'success', message: `Review ${status}.` }
}

export async function deleteReview(id: string): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const db = createAdminClient()
  const { data } = await db
    .from('reviews')
    .select('products ( slug )')
    .eq('id', id)
    .maybeSingle()

  const { error } = await db.from('reviews').delete().eq('id', id)
  if (error) return { status: 'error', message: error.message }

  revalidateStorefront(
    one<{ slug?: string }>((data as { products?: unknown } | null)?.products as never)?.slug
  )
  revalidatePath('/admin/reviews')
  return { status: 'success', message: 'Review deleted.' }
}

const seedReviewSchema = z.object({
  product_id: z.string().uuid('Pick a product.'),
  reviewer_name: z.string().trim().min(2, 'Add a reviewer name.').max(60),
  reviewer_location: z.string().trim().max(80).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  review_text: z.string().trim().min(5, 'Add some review text.').max(1500),
})

/**
 * Adds a review the owner is writing themselves — a testimonial collected over
 * email, say. Marked source='seed' so it stays distinguishable from organic
 * submissions forever, which matters if these ever need auditing or removing in
 * bulk.
 */
export async function createSeedReview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const parsed = seedReviewSchema.safeParse({
    product_id: formData.get('product_id'),
    reviewer_name: formData.get('reviewer_name'),
    reviewer_location: formData.get('reviewer_location') || undefined,
    rating: formData.get('rating'),
    review_text: formData.get('review_text'),
  })
  if (!parsed.success) {
    return { status: 'error', fieldErrors: firstErrors(parsed.error) }
  }

  const db = createAdminClient()
  const { error } = await db.from('reviews').insert({
    ...parsed.data,
    reviewer_location: parsed.data.reviewer_location ?? null,
    source: 'seed',
    status: 'approved',
    is_verified_purchase: false,
  })

  if (error) return { status: 'error', message: error.message }

  const { data } = await db
    .from('products')
    .select('slug')
    .eq('id', parsed.data.product_id)
    .maybeSingle()

  revalidateStorefront(data?.slug)
  revalidatePath('/admin/reviews')
  return { status: 'success', message: 'Review added.' }
}

// ========================================================== manual orders

/**
 * Produces the download link to paste into the delivery email.
 *
 * Deliberately separate from marking the order delivered: the admin needs the
 * link BEFORE they can send anything, and coupling the two would mean an order
 * flipping to "delivered" the moment a link was generated, even if the email
 * was never sent.
 */
export async function getDeliveryLink(orderId: string): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const { data, error } = await createAdminClient()
    .from('manual_orders')
    .select('id, products ( title, file_url )')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data) return { status: 'error', message: 'Order not found.' }

  const product = one<{ title: string; file_url: string | null }>(
    (data as { products?: unknown }).products as never
  )
  if (!product?.file_url) {
    return {
      status: 'error',
      message: 'That product has no file attached yet — upload one on the product page first.',
    }
  }

  const signed = await createSignedDownloadUrl(product.file_url)
  if ('error' in signed) return { status: 'error', message: signed.error }

  return { status: 'success', url: signed.url, message: 'Link ready — expires in 7 days.' }
}

export async function setOrderDelivered(
  orderId: string,
  delivered: boolean
): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const { error } = await createAdminClient()
    .from('manual_orders')
    .update({
      status: delivered ? 'delivered' : 'pending',
      delivered_at: delivered ? new Date().toISOString() : null,
    })
    .eq('id', orderId)

  if (error) return { status: 'error', message: error.message }

  // sales_count moved, so the product's social proof is stale.
  revalidateStorefront()
  revalidatePath('/admin/orders')
  return {
    status: 'success',
    message: delivered ? 'Marked as delivered.' : 'Moved back to pending.',
  }
}

/**
 * The one-click path: mint a link, email it, mark the order delivered.
 *
 * Order matters. The email is sent BEFORE the order is marked delivered, and a
 * failed send leaves the row pending — because an order marked delivered that
 * was never actually emailed is invisible: it drops off the queue, stops being
 * chased, and the buyer simply never hears from us. The reverse failure (a
 * delivered email on a still-pending order) is harmless and self-correcting,
 * since the admin can see the order and mark it manually.
 */
export async function sendOrderFile(orderId: string): Promise<ActionState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  if (!(await isEmailConfigured())) {
    return { status: 'error', message: EMAIL_SETUP_HINT }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('manual_orders')
    .select('id, buyer_email, buyer_name, status, products ( title, file_url, file_type )')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data) return { status: 'error', message: 'Order not found.' }

  const order = data as {
    buyer_email: string
    buyer_name: string | null
    status: string
    products?: unknown
  }
  const product = one<{ title: string; file_url: string | null; file_type: string | null }>(
    order.products as never
  )

  if (!product?.file_url) {
    return {
      status: 'error',
      message: 'That product has no file attached yet — upload one on the product page first.',
    }
  }

  const signed = await createSignedDownloadUrl(product.file_url)
  if ('error' in signed) return { status: 'error', message: signed.error }

  const sent = await sendDeliveryEmail({
    to: order.buyer_email,
    buyerName: order.buyer_name,
    productTitle: product.title,
    downloadUrl: signed.url,
    expiresIn: describeExpiry(),
    fileTypeLabel: product.file_type ? fileTypeLabel(product.file_type) : null,
  })

  if (!sent.ok) {
    return { status: 'error', message: `Email not sent: ${sent.error}` }
  }

  const { error: updateError } = await db
    .from('manual_orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', orderId)

  if (updateError) {
    // The buyer has their file; only our bookkeeping failed. Say exactly that,
    // so nobody sends it a second time trying to fix the status.
    return {
      status: 'error',
      message: `Email sent, but the order could not be marked delivered (${updateError.message}). Mark it manually.`,
    }
  }

  revalidateStorefront()
  revalidatePath('/admin/orders')
  return { status: 'success', message: `Sent to ${order.buyer_email}.` }
}

/** Lets the orders page render the right controls without leaking env vars. */
export async function emailStatus(): Promise<{ configured: boolean; hint: string }> {
  return { configured: await isEmailConfigured(), hint: EMAIL_SETUP_HINT }
}
