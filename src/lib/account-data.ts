import 'server-only'

import { createAdminClient } from './supabase/admin'

export interface Purchase {
  id: string
  status: 'pending' | 'delivered'
  amount: number | null
  currency: string
  created_at: string
  delivered_at: string | null
  checkout_token: string | null
  product: {
    slug: string
    title: string
    file_type: string | null
    file_size_mb: number | null
    preview_image_url: string | null
  } | null
}

export interface WishlistItem {
  id: string
  created_at: string
  product: {
    id: string
    slug: string
    title: string
    price: number
    compare_at_price: number | null
    currency: string
    file_type: string | null
    preview_image_url: string | null
    rating_avg: number
    rating_count: number
  } | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  !v ? null : Array.isArray(v) ? (v[0] ?? null) : v

/**
 * Every buyer read goes through the secret key, filtered by user_id.
 *
 * manual_orders has no public policy and no column grant for the authenticated
 * role — buyer emails and checkout tokens live there — so the browser is never
 * given a client that could query it. Scoping happens here, in one place, rather
 * than being restated at each call site.
 */
export async function getPurchases(userId: string): Promise<Purchase[]> {
  const { data } = await createAdminClient()
    .from('manual_orders')
    .select(
      `id, status, amount, currency, created_at, delivered_at, checkout_token,
       products ( slug, title, file_type, file_size_mb, preview_image_url )`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: row.id as string,
    status: row.status as 'pending' | 'delivered',
    amount: row.amount === null ? null : Number(row.amount),
    currency: (row.currency as string) ?? 'USD',
    created_at: row.created_at as string,
    delivered_at: (row.delivered_at as string | null) ?? null,
    checkout_token: (row.checkout_token as string | null) ?? null,
    product: one<Purchase['product']>(row.products as never),
  }))
}

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const { data } = await createAdminClient()
    .from('wishlists')
    .select(
      `id, created_at,
       products ( id, slug, title, price, compare_at_price, currency, file_type,
                  preview_image_url, rating_avg, rating_count, status )`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return ((data as Record<string, unknown>[]) ?? [])
    .map((row) => {
      const p = one<Record<string, unknown>>(row.products as never)
      // A product unpublished after being saved should quietly drop out rather
      // than link to a 404.
      if (!p || p.status !== 'active') return { id: row.id as string, created_at: row.created_at as string, product: null }
      return {
        id: row.id as string,
        created_at: row.created_at as string,
        product: {
          id: p.id as string,
          slug: p.slug as string,
          title: p.title as string,
          price: Number(p.price ?? 0),
          compare_at_price: p.compare_at_price === null ? null : Number(p.compare_at_price),
          currency: (p.currency as string) ?? 'USD',
          file_type: (p.file_type as string | null) ?? null,
          preview_image_url: (p.preview_image_url as string | null) ?? null,
          rating_avg: Number(p.rating_avg ?? 0),
          rating_count: Number(p.rating_count ?? 0),
        },
      }
    })
    .filter((w) => w.product !== null)
}

/** Which of these product ids the buyer has saved — for the save buttons. */
export async function getWishlistIds(userId: string): Promise<Set<string>> {
  const { data } = await createAdminClient()
    .from('wishlists')
    .select('product_id')
    .eq('user_id', userId)

  return new Set(((data as { product_id: string }[]) ?? []).map((r) => r.product_id))
}
