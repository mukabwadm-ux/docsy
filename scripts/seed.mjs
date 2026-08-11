/**
 * Seeds the Docsy demo catalog.
 *
 * Idempotent: products are matched on `slug`, so re-running updates rather than
 * duplicates.
 *
 *   node scripts/seed.mjs [--wipe] [--no-images]
 *
 * --wipe        clears products, categories and reviews first
 * --no-images   skips the Unsplash fetch (fast, but products have no covers)
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { categories, products } from './seed-data.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const wipe = process.argv.includes('--wipe')
const skipImages = process.argv.includes('--no-images')

const IMAGES = 'product-images'
const FILES = 'digital-products'
const NOW = Date.now()
const DAY = 86400000

/**
 * Deterministic backdating. Without it every seeded review carries the same
 * created_at and the product page renders a wall of "Today", which reads as
 * obviously fabricated on a page whose entire job is to look credible.
 */
const daysAgo = (n) => new Date(NOW - n * DAY).toISOString()

const unsplash = (id) =>
  `https://images.unsplash.com/${id}?w=1200&h=1500&q=80&fm=jpg&fit=crop&crop=entropy`

/** Bounded concurrency so we do not open 40 sockets at once. */
async function pool(items, limit, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    })
  )
  return out
}

async function fetchBuffer(src) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(45000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 800 * attempt))
    }
  }
}

async function uploadImage(path, buffer) {
  const { error } = await db.storage
    .from(IMAGES)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  return `${url}/storage/v1/object/public/${IMAGES}/${path}`
}

// ------------------------------------------------------------------- wipe
if (wipe) {
  process.stdout.write('wiping catalog ... ')
  const ZERO = '00000000-0000-0000-0000-000000000000'
  for (const t of ['reviews', 'manual_orders', 'orders', 'product_images', 'products', 'categories']) {
    const { error } = await db.from(t).delete().neq('id', ZERO)
    if (error) throw new Error(`wipe ${t}: ${error.message}`)
  }
  console.log('ok')
}

// ------------------------------------------------------------- categories
process.stdout.write('categories ... ')
const { data: cats, error: catErr } = await db
  .from('categories')
  .upsert(categories, { onConflict: 'slug' })
  .select('id, slug')
if (catErr) throw new Error(catErr.message)
const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]))
console.log(`${cats.length} ok`)

// ------------------------------------------------------- placeholder files
/**
 * A tiny text stand-in per product, so the private bucket is populated and the
 * signed-link delivery flow is exercisable end to end before real files exist.
 * Replace them by uploading the real file on the product's admin page.
 */
process.stdout.write('placeholder files ... ')
let fileCount = 0
for (const p of products) {
  const path = `demo/${p.slug}.txt`
  const body = Buffer.from(
    `${p.title}\n\nThis is a placeholder, not the real product.\n` +
      `Upload the actual file from the admin panel:\n  /admin/products\n`,
    'utf8'
  )
  const { error } = await db.storage
    .from(FILES)
    .upload(path, body, { contentType: 'text/plain', upsert: true })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  p._filePath = path
  fileCount++
}
console.log(`${fileCount} ok`)

// ----------------------------------------------------------------- images
const imageUrls = new Map() // slug -> [url]

if (skipImages) {
  console.log('images ... skipped')
} else {
  process.stdout.write('images ... ')
  const jobs = []
  for (const p of products) {
    // Cover comes from the first story block that has an image; falling back to
    // a per-product id would mean inventing photo ids that may not exist.
    const ids = [
      ...(p.story_content ?? []).map((b) => b.img).filter(Boolean),
      ...(p.how_it_works ?? []).map((s) => s.img).filter(Boolean),
    ]
    ids.slice(0, 3).forEach((id, i) => jobs.push({ slug: p.slug, i, id }))
  }

  const uploaded = await pool(jobs, 5, async (job) => {
    try {
      const buf = await fetchBuffer(unsplash(job.id))
      const publicUrl = await uploadImage(`products/${job.slug}/${job.i}.jpg`, buf)
      return { ...job, publicUrl }
    } catch (err) {
      // A single unavailable photo must not abort the whole seed.
      console.warn(`\n  warning: image ${job.id} failed (${err.message})`)
      return null
    }
  })

  for (const u of uploaded.filter(Boolean).sort((a, b) => a.i - b.i)) {
    if (!imageUrls.has(u.slug)) imageUrls.set(u.slug, [])
    imageUrls.get(u.slug).push(u.publicUrl)
  }
  console.log(`${uploaded.filter(Boolean).length} ok`)
}

// --------------------------------------------------------------- products
process.stdout.write('products ... ')

/**
 * Every row must carry every optional key. PostgREST bulk-inserts the union of
 * keys across the payload, so a key omitted on one row arrives as an explicit
 * NULL — it does not fall back to the column default.
 */
const DEFAULTS = {
  description: null,
  short_description: null,
  announcement_text: null,
  compare_at_price: null,
  currency: 'USD',
  category_id: null,
  file_url: null,
  file_size_mb: null,
  file_type: null,
  preview_image_url: null,
  is_featured: false,
  benefits: [],
  story_content: [],
  how_it_works: [],
  status: 'active',
}

const rows = products.map((p) => {
  const covers = imageUrls.get(p.slug) ?? []
  return {
    ...DEFAULTS,
    title: p.title,
    slug: p.slug,
    short_description: p.short_description ?? null,
    announcement_text: p.announcement_text ?? null,
    benefits: p.benefits ?? [],
    // Strip the seeding-only `img` key and swap in the uploaded URL.
    story_content: (p.story_content ?? []).map((b, i) => ({
      heading: b.heading,
      body: b.body,
      image_url: b.img ? covers[i] ?? null : null,
    })),
    how_it_works: (p.how_it_works ?? []).map((s, i) => ({
      step_number: i + 1,
      title: s.title,
      caption: s.caption,
      image_url: s.img ? covers[i] ?? null : null,
    })),
    price: p.price,
    compare_at_price: p.compare_at_price ?? null,
    currency: 'USD',
    category_id: catId[p.category] ?? null,
    file_url: p._filePath,
    file_size_mb: p.file_size_mb ?? null,
    file_type: p.file_type ?? null,
    preview_image_url: covers[0] ?? null,
    is_featured: p.is_featured ?? false,
    status: 'active',
  }
})

const { data: inserted, error: prodErr } = await db
  .from('products')
  .upsert(rows, { onConflict: 'slug' })
  .select('id, slug')
if (prodErr) throw new Error(prodErr.message)
const prodId = Object.fromEntries(inserted.map((p) => [p.slug, p.id]))
console.log(`${inserted.length} ok`)

// --------------------------------------------------------- product_images
process.stdout.write('product_images ... ')
const imageRows = []
for (const p of products) {
  const pid = prodId[p.slug]
  const covers = imageUrls.get(p.slug) ?? []
  covers.forEach((image_url, i) => {
    imageRows.push({
      product_id: pid,
      image_url,
      alt_text: i === 0 ? p.title : `${p.title} — view ${i + 1}`,
      sort_order: i,
    })
  })
}
await db.from('product_images').delete().in('product_id', Object.values(prodId))
if (imageRows.length > 0) {
  const { error } = await db.from('product_images').insert(imageRows)
  if (error) throw new Error(error.message)
}
console.log(`${imageRows.length} ok`)

// ---------------------------------------------------------------- reviews
process.stdout.write('reviews ... ')
const reviewRows = []
for (const p of products) {
  const pid = prodId[p.slug]
  for (const r of p.reviews ?? []) {
    reviewRows.push({
      product_id: pid,
      reviewer_name: r.name,
      reviewer_location: r.location ?? null,
      rating: r.rating,
      review_text: r.text,
      source: 'seed',
      is_verified_purchase: true,
      status: 'approved',
      created_at: daysAgo(r.days ?? 7),
    })
  }
}
// Delete first so re-running does not multiply the same testimonials.
await db.from('reviews').delete().in('product_id', Object.values(prodId)).eq('source', 'seed')
if (reviewRows.length > 0) {
  const { error } = await db.from('reviews').insert(reviewRows)
  if (error) throw new Error(error.message)
}
console.log(`${reviewRows.length} ok`)

console.log('\nSeed complete.')
console.log('Note: product files are placeholders — upload the real ones from /admin/products.')
