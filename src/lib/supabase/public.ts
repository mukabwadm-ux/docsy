import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous, cookie-free client for reading the public catalog from Server
 * Components.
 *
 * Deliberately NOT the cookie-bound server client: touching cookies() opts a
 * route out of static rendering, and the catalog and product pages are meant to
 * be statically generated with ISR. This client sees exactly what a logged-out
 * visitor sees, which is all those pages need.
 */
function build(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Name what is missing. The underlying client throws a bare
  // "supabaseUrl is required." from inside a bundled chunk, which during
  // `next build` surfaces as "Failed to collect page data for /" with a webpack
  // stack and no mention of environment variables at all.
  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ]
      .filter(Boolean)
      .join(' and ')

    throw new Error(
      `Supabase is not configured: ${missing} is not set. ` +
        'Locally these live in .env.local; on Vercel add them under ' +
        'Settings → Environment Variables, then redeploy.'
    )
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      /**
       * Catalog reads may be cached, but bounded. Next's default for a patched
       * fetch is to cache indefinitely, which would leave a product page serving
       * last week's price long after its ISR window elapsed. Pin the fetch cache
       * to the same 60s the pages revalidate on.
       */
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: 60 } } as RequestInit),
    },
  })
}

let instance: SupabaseClient | null = null

/**
 * Built on first use, not at import time.
 *
 * An eagerly constructed client runs during `next build`'s module evaluation, so
 * a missing variable took down page-data collection before any of our code —
 * including the error message above — had a chance to run. Deferring construction
 * means the failure happens inside a query, where the message is attributable.
 *
 * A Proxy rather than a getPublicDb() function keeps every existing
 * `publicDb.from(…)` call site unchanged.
 */
export const publicDb = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    instance ??= build()
    const value = Reflect.get(instance, prop, receiver)
    // Methods must stay bound to the real client, or `this` is the Proxy.
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
