'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Phase 1 purchase intent.
 *
 * No gateway is wired up yet, so "Buy now" records the buyer's email against
 * the product and the file is delivered by hand from the admin queue. When
 * Stripe lands, this action is what gets swapped for a session redirect — the
 * form, the validation and the success copy all stay.
 */

/**
 * Email is the only required field.
 *
 * A digital download needs exactly one thing to be deliverable: somewhere to send
 * it. Name and note are collected only if the buyer volunteers them — every extra
 * required box on a $19 impulse purchase is another chance to abandon.
 */
const schema = z.object({
  productId: z.string().uuid('Something went wrong — please reload the page.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email — this is where your file goes.')
    .max(160),
  name: z.string().trim().max(80, 'That name is too long.').optional(),
  note: z.string().trim().max(500, 'Please keep the note under 500 characters.').optional(),
})

export interface PurchaseState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'name' | 'email' | 'note', string>>
}

export async function requestPurchase(
  _prev: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const parsed = schema.safeParse({
    productId: formData.get('productId'),
    email: formData.get('email'),
    name: formData.get('name') || undefined,
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: PurchaseState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'email' || key === 'note') {
        fieldErrors[key] ??= issue.message
      }
    }
    // A bad productId is not a field the buyer can fix, so it surfaces as a
    // general message rather than silently doing nothing.
    const productIssue = parsed.error.issues.find((i) => i.path[0] === 'productId')
    return {
      status: 'error',
      fieldErrors,
      message: productIssue?.message,
    }
  }

  const { productId, email, name, note } = parsed.data
  const db = createAdminClient()

  /**
   * Re-read the price server-side. The rendered page carries a price, but a
   * value posted from the browser is a suggestion, not a fact — and this
   * snapshot is what the fulfilment queue shows and what revenue gets counted
   * from. Reading `status` too means a draft or archived product cannot be
   * bought through a stale tab.
   */
  const { data: product, error: lookupError } = await db
    .from('products')
    .select('id, title, price, currency, status')
    .eq('id', productId)
    .maybeSingle()

  if (lookupError) {
    return { status: 'error', message: 'We could not reach the store. Please try again.' }
  }
  if (!product || product.status !== 'active') {
    return { status: 'error', message: 'This product is no longer available.' }
  }

  const { error } = await db.from('manual_orders').insert({
    product_id: product.id,
    buyer_email: email,
    buyer_name: name ?? null,
    note: note ?? null,
    amount: product.price,
    currency: product.currency,
    status: 'pending',
  })

  if (error) {
    return {
      status: 'error',
      message: 'We could not record your order. Please try again in a moment.',
    }
  }

  // Greet by first name only when one was given; "Thanks undefined" is worse
  // than no greeting at all.
  const firstName = name?.split(' ')[0]
  return {
    status: 'success',
    message: firstName
      ? `Thanks ${firstName} — your order is in. Your download link is on its way to ${email}.`
      : `Your order is in. Your download link is on its way to ${email}.`,
  }
}
