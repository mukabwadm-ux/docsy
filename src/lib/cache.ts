import { unstable_cache } from 'next/cache'

/**
 * Cache tags for the storefront's data reads.
 *
 * Why this exists at all: the storefront layout renders SiteHeader and Analytics,
 * both async server components that read the database. An uncached read inside a
 * layout makes every route beneath it render on demand — which is why the catalog,
 * the homepage and even the static privacy and terms pages were all served with
 * `Cache-Control: no-store` and missed the CDN on every single request.
 *
 * Caching those reads lets the pages prerender again. `revalidatePath` alone does
 * not clear these entries, so every mutation that changes catalog data has to
 * invalidate the matching tag as well — see revalidateStorefront in actions/admin.
 */
export const TAGS = {
  products: 'products',
  categories: 'categories',
  reviews: 'reviews',
  config: 'app-config',
} as const

/**
 * How long a cached read may be stale, in seconds.
 *
 * These are ceilings, not the expected lag: a tag invalidation on save is what
 * normally refreshes the data, and these only matter if a write happens outside
 * the app — a row edited straight in Supabase, say. Categories and analytics IDs
 * change rarely and sit high; product data tracks the pages' own revalidate = 60.
 */
export const TTL = {
  products: 60,
  categories: 300,
  reviews: 120,
  config: 300,
} as const

/**
 * Wraps a data read in Next's data cache.
 *
 * The arguments of the returned function join `keyParts` to form the cache key, so
 * one wrapper serves every variant of a parameterised query — but that also means
 * a read taking a whole object as an argument would serialise the object into the
 * key. Those are left uncached rather than given a large, near-unique key.
 */
export function cachedRead<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  options: { tags: string[]; revalidate: number }
) {
  return unstable_cache(fn, keyParts, {
    tags: options.tags,
    revalidate: options.revalidate,
  })
}
