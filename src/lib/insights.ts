import 'server-only'

import { createAdminClient } from './supabase/admin'

/**
 * Records a search phrase.
 *
 * Deliberately NOT called for every keystroke. The typeahead fires a request per
 * settled keystroke, so logging there would fill the table with the prefixes of
 * one phrase — "res", "resu", "resum", "resume" — and bury the actual query
 * under its own fragments. Only two things are logged:
 *
 *   1. a committed search (the /search page rendered for a query)
 *   2. a typeahead query that returned nothing and was then abandoned
 *
 * The second is the valuable one. Somebody typed a phrase, saw no results, and
 * gave up without pressing Enter — which is exactly the demand signal that never
 * reaches a shop otherwise.
 */
export async function recordSearch(query: string, resultCount: number) {
  const trimmed = query.trim()
  if (trimmed.length < 3 || trimmed.length > 120) return

  // Fire and forget. A failed log must never affect the response a visitor is
  // waiting on, and there is nothing useful to do about it here.
  await createAdminClient()
    .rpc('record_search', { p_query: trimmed, p_result_count: resultCount })
    .then(() => undefined, () => undefined)
}

export interface ProductPerformance {
  id: string
  title: string
  slug: string
  status: string
  price: number
  currency: string
  views: number
  /** Orders placed, whether or not the file has gone out yet. */
  orders: number
  /** Orders whose file has been delivered — what actually earned money. */
  completed: number
  revenue: number
  conversion: number | null
  ratingAvg: number
  ratingCount: number
}

export interface InsightsData {
  totals: {
    views: number
    orders: number
    completed: number
    revenue: number
    conversion: number | null
  }
  products: ProductPerformance[]
  /** Traffic but no sales — a price, copy or trust problem. */
  notConverting: ProductPerformance[]
  /** Live but nobody has seen it — a marketing problem, not a page problem. */
  noTraffic: ProductPerformance[]
  searches: {
    normalized: string
    sample: string
    hits: number
    result_count: number
    last_seen: string
  }[]
  emptySearches: {
    normalized: string
    sample: string
    hits: number
    result_count: number
    last_seen: string
  }[]
}

/**
 * A product needs a meaningful amount of traffic before "no sales" means
 * anything. Below this, zero sales is just a small sample.
 */
const MIN_VIEWS_TO_JUDGE = 15

export async function getInsights(): Promise<InsightsData> {
  const db = createAdminClient()

  const [productRows, manualRows, gatewayRows, searchRows] = await Promise.all([
    db
      .from('products')
      .select(
        'id, title, slug, status, price, currency, views_count, sales_count, rating_avg, rating_count'
      )
      .neq('status', 'archived')
      .order('views_count', { ascending: false }),
    db.from('manual_orders').select('product_id, amount, base_amount, status'),
    db.from('orders').select('product_id, amount, base_amount, status').eq('status', 'paid'),
    db
      .from('search_queries')
      .select('normalized, sample, hits, result_count, last_seen')
      .order('hits', { ascending: false })
      .limit(60),
  ])

  const orderCount = new Map<string, number>()
  const completedCount = new Map<string, number>()
  const revenue = new Map<string, number>()

  const bump = (map: Map<string, number>, key: string | null, by = 1) => {
    if (!key) return
    map.set(key, (map.get(key) ?? 0) + by)
  }

  // Revenue is summed from base_amount, the USD equivalent, so a KES order and a
  // USD one are comparable. `amount` is what was charged, not a common unit.
  type Row = { product_id: string | null; amount: number | null; base_amount: number | null; status?: string }
  const usdOf = (o: Row) => Number(o.base_amount ?? o.amount ?? 0)

  for (const o of (manualRows.data as Row[]) ?? []) {
    bump(orderCount, o.product_id)
    if (o.status === 'delivered') {
      bump(completedCount, o.product_id)
      bump(revenue, o.product_id, usdOf(o))
    }
  }
  for (const o of (gatewayRows.data as Row[]) ?? []) {
    bump(orderCount, o.product_id)
    bump(completedCount, o.product_id)
    bump(revenue, o.product_id, usdOf(o))
  }

  const products: ProductPerformance[] = (
    (productRows.data as Record<string, unknown>[]) ?? []
  ).map((p) => {
    const id = p.id as string
    const views = Number(p.views_count ?? 0)
    const completed = completedCount.get(id) ?? 0

    return {
      id,
      title: p.title as string,
      slug: p.slug as string,
      status: p.status as string,
      price: Number(p.price ?? 0),
      currency: (p.currency as string) ?? 'USD',
      views,
      orders: orderCount.get(id) ?? 0,
      completed,
      revenue: revenue.get(id) ?? 0,
      // Null rather than 0 when there is no traffic: "0%" claims the page fails
      // to convert, when in fact it has not been tested.
      conversion: views > 0 ? (completed / views) * 100 : null,
      ratingAvg: Number(p.rating_avg ?? 0),
      ratingCount: Number(p.rating_count ?? 0),
    }
  })

  const totalViews = products.reduce((s, p) => s + p.views, 0)
  const totalCompleted = products.reduce((s, p) => s + p.completed, 0)

  const searches = (searchRows.data as InsightsData['searches']) ?? []

  return {
    totals: {
      views: totalViews,
      orders: products.reduce((s, p) => s + p.orders, 0),
      completed: totalCompleted,
      revenue: products.reduce((s, p) => s + p.revenue, 0),
      conversion: totalViews > 0 ? (totalCompleted / totalViews) * 100 : null,
    },
    products,
    notConverting: products
      .filter((p) => p.status === 'active' && p.views >= MIN_VIEWS_TO_JUDGE && p.completed === 0)
      .sort((a, b) => b.views - a.views),
    noTraffic: products.filter((p) => p.status === 'active' && p.views === 0),
    searches,
    emptySearches: searches.filter((s) => s.result_count === 0),
  }
}
