import { publicDb } from './supabase/public'
import type {
  CatalogSort,
  Category,
  HowItWorksStep,
  Product,
  Review,
  StoryBlock,
} from './types'

/**
 * Every public product read names its columns explicitly.
 *
 * `select=*` is not an option: migration 0003 revokes the blanket SELECT on
 * products so that `file_url` — the private Storage path of a paid file —
 * cannot be requested with the publishable key. A `*` here would ask for that
 * column and fail the whole query with "permission denied for table products".
 */
const PRODUCT_COLUMNS = `
  id, title, slug, description, short_description,
  benefits, story_content, how_it_works, announcement_text,
  price, compare_at_price, currency, category_id,
  file_size_mb, file_type, preview_image_url,
  is_featured, views_count, sales_count,
  rating_avg, rating_count, status, created_at, updated_at
`

const CARD_COLUMNS = `
  id, title, slug, short_description,
  price, compare_at_price, currency, category_id,
  file_type, preview_image_url,
  is_featured, sales_count, rating_avg, rating_count, created_at
`

/**
 * PostgREST returns numerics as strings and jsonb as already-parsed values, and
 * a column that has never been written comes back null even where the schema
 * has a default. Coercing once here means no component has to defend itself.
 */
function normalise(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    price: Number(row.price ?? 0),
    compare_at_price: row.compare_at_price === null ? null : Number(row.compare_at_price),
    rating_avg: Number(row.rating_avg ?? 0),
    rating_count: Number(row.rating_count ?? 0),
    sales_count: Number(row.sales_count ?? 0),
    views_count: Number(row.views_count ?? 0),
    file_size_mb: row.file_size_mb === null ? null : Number(row.file_size_mb),
    benefits: Array.isArray(row.benefits) ? (row.benefits as string[]) : [],
    story_content: Array.isArray(row.story_content) ? (row.story_content as StoryBlock[]) : [],
    how_it_works: Array.isArray(row.how_it_works) ? (row.how_it_works as HowItWorksStep[]) : [],
  }
}

const SORT_MAP: Record<CatalogSort, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  'price-asc': { column: 'price', ascending: true },
  'price-desc': { column: 'price', ascending: false },
  rating: { column: 'rating_avg', ascending: false },
  popular: { column: 'sales_count', ascending: false },
}

// ------------------------------------------------------------------ catalog

export async function getCategories(): Promise<Category[]> {
  const { data } = await publicDb
    .from('categories')
    .select('id, name, slug, description, icon, sort_order')
    .order('sort_order')
    .order('name')
  return (data as Category[]) ?? []
}

/** Category list with a live count of active products, for the homepage grid. */
export async function getCategoriesWithCounts() {
  const [categories, { data: rows }] = await Promise.all([
    getCategories(),
    publicDb.from('products').select('category_id').eq('status', 'active'),
  ])

  const counts = new Map<string, number>()
  for (const r of (rows as { category_id: string | null }[]) ?? []) {
    if (r.category_id) counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1)
  }

  return categories.map((c) => ({ ...c, product_count: counts.get(c.id) ?? 0 }))
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const { data } = await publicDb
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'active')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as Record<string, unknown>[]) ?? []).map(normalise)
}

export async function getLatestProducts(limit = 8): Promise<Product[]> {
  const { data } = await publicDb
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as Record<string, unknown>[]) ?? []).map(normalise)
}

export interface CatalogParams {
  category?: string
  sort?: CatalogSort
  page?: number
  perPage?: number
  q?: string
  maxPrice?: number
}

export async function getCatalog({
  category,
  sort = 'newest',
  page = 1,
  perPage = 12,
  q,
  maxPrice,
}: CatalogParams) {
  let categoryId: string | undefined
  if (category) {
    const { data } = await publicDb
      .from('categories')
      .select('id')
      .eq('slug', category)
      .maybeSingle()
    // An unknown category slug must yield an empty page, not the whole catalog.
    // Returning early is the only way to say that — filtering on `undefined`
    // silently drops the constraint.
    if (!data) {
      return { products: [], total: 0, page, perPage, totalPages: 0 }
    }
    categoryId = (data as { id: string }).id
  }

  let query = publicDb
    .from('products')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'active')

  if (categoryId) query = query.eq('category_id', categoryId)
  if (typeof maxPrice === 'number') query = query.lte('price', maxPrice)
  if (q?.trim()) query = query.textSearch('search_vector', toTsQuery(q), { config: 'english' })

  const { column, ascending } = SORT_MAP[sort] ?? SORT_MAP.newest
  const from = (page - 1) * perPage

  const { data, count } = await query
    .order(column, { ascending })
    // Tie-break on id so the same row never appears on two pages. Without it,
    // any two products sharing a sort value can swap places between requests
    // and one of them vanishes from the paginated set entirely.
    .order('id', { ascending: true })
    .range(from, from + perPage - 1)

  const total = count ?? 0
  return {
    products: ((data as Record<string, unknown>[]) ?? []).map(normalise),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

// ------------------------------------------------------------------ product

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await publicDb
    .from('products')
    .select(
      `${PRODUCT_COLUMNS},
       categories ( id, name, slug, description, icon, sort_order ),
       product_images ( id, image_url, alt_text, sort_order )`
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return null

  const product = normalise(data as Record<string, unknown>)
  product.product_images = (product.product_images ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  )
  return product
}

export async function getAllProductSlugs(): Promise<{ slug: string }[]> {
  const { data } = await publicDb.from('products').select('slug').eq('status', 'active')
  return (data as { slug: string }[]) ?? []
}

/** Same category first, then anything else, never the product itself. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const collected: Product[] = []
  const seen = new Set([product.id])

  if (product.category_id) {
    const { data } = await publicDb
      .from('products')
      .select(CARD_COLUMNS)
      .eq('status', 'active')
      .eq('category_id', product.category_id)
      .neq('id', product.id)
      .order('sales_count', { ascending: false })
      .limit(limit)

    for (const row of (data as Record<string, unknown>[]) ?? []) {
      const p = normalise(row)
      collected.push(p)
      seen.add(p.id)
    }
  }

  if (collected.length < limit) {
    const { data } = await publicDb
      .from('products')
      .select(CARD_COLUMNS)
      .eq('status', 'active')
      .neq('id', product.id)
      .order('sales_count', { ascending: false })
      // Over-fetch: some of what comes back is already in `collected`, and
      // filtering after the fact would otherwise leave the row short.
      .limit(limit * 3)

    for (const row of (data as Record<string, unknown>[]) ?? []) {
      if (collected.length >= limit) break
      const p = normalise(row)
      if (seen.has(p.id)) continue
      collected.push(p)
      seen.add(p.id)
    }
  }

  return collected.slice(0, limit)
}

// ------------------------------------------------------------------ reviews

export async function getReviews(productId: string, limit = 24): Promise<Review[]> {
  const { data } = await publicDb
    .from('reviews')
    .select(
      'id, product_id, reviewer_name, reviewer_location, rating, review_text, source, is_verified_purchase, status, created_at'
    )
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as Review[]) ?? []
}

// ------------------------------------------------------------------- search

/**
 * Builds a prefix tsquery: "budget templ" -> "budget & templ:*".
 *
 * Raw user input cannot go into textSearch directly — an unbalanced quote or a
 * stray `&` is a syntax error that surfaces as a 500 on the search page.
 * Stripping to alphanumeric words and joining them ourselves means any input is
 * safe, and the trailing :* makes the last word match as a prefix so results
 * appear while the visitor is still typing.
 */
function toTsQuery(input: string) {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)

  if (words.length === 0) return ''
  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(' & ')
}

export async function searchProducts(q: string, limit = 24): Promise<Product[]> {
  const tsq = toTsQuery(q)
  if (!tsq) return []

  const { data } = await publicDb
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'active')
    .textSearch('search_vector', tsq, { config: 'english' })
    .limit(limit)

  const rows = ((data as Record<string, unknown>[]) ?? []).map(normalise)
  if (rows.length > 0) return rows

  // Nothing matched the stemmed index. Fall back to a substring match on the
  // title, which catches what tsquery structurally cannot: a mid-word fragment
  // ("alendar"), a typo, or a hyphen split differently to how the text was
  // indexed. `products_title_trgm_idx` is what keeps this cheap.
  return substringSearch(q, limit)
}

/**
 * Categories whose name matches the query.
 *
 * `search_vector` covers title, short_description and description — not the
 * category a product belongs to, because a generated column cannot reach into
 * another table. The practical effect was that searching "template" returned
 * nothing on a shop with a category called Templates, which is the single most
 * likely thing a visitor types.
 *
 * Surfacing the category as its own suggestion fixes that without a schema
 * change, and lands the visitor somewhere better than a result list: the whole
 * category.
 */
export async function searchCategories(q: string, limit = 3) {
  const safe = q.replace(/[%_,()]/g, ' ').trim().slice(0, 40)
  if (safe.length < 2) return []

  const { data } = await publicDb
    .from('categories')
    .select('id, name, slug, description, icon, sort_order')
    .ilike('name', `%${safe}%`)
    .order('sort_order')
    .limit(limit)

  return (data as Category[]) ?? []
}

/** Everything the typeahead needs, in one round trip. */
export async function searchSuggestions(q: string, limit = 6) {
  const [products, categories] = await Promise.all([
    searchProducts(q, limit),
    searchCategories(q, 3),
  ])
  return { products, categories }
}

async function substringSearch(q: string, limit: number): Promise<Product[]> {
  // A comma would be read as a filter separator by PostgREST, and % / _ are
  // LIKE wildcards that would let input match far more than it should.
  const safe = q.replace(/[%_,()]/g, ' ').trim().slice(0, 60)
  if (safe.length < 2) return []

  const { data } = await publicDb
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'active')
    .ilike('title', `%${safe}%`)
    .order('sales_count', { ascending: false })
    .limit(limit)

  return ((data as Record<string, unknown>[]) ?? []).map(normalise)
}
