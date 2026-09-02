import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Secret-key client. Bypasses RLS entirely.
 *
 * The `server-only` import above turns importing this from a Client Component
 * into a build error rather than a leaked key.
 *
 * Every call site must do its own authorisation check first — see requireAdmin()
 * in src/lib/auth.ts.
 */
export function createAdminClient(options?: {
  /**
   * Drop the `no-store` override below, for a caller that is itself inside
   * `unstable_cache`.
   *
   * Required there, not merely preferable: `unstable_cache` refuses to run a
   * `no-store` fetch and fails it with "Dynamic server usage". supabase-js turns
   * that into `{ data: null, error }` rather than throwing, so a caller that
   * ignores `error` sees an empty result and carries on — which is how every
   * database-backed config value silently became null once the analytics read was
   * wrapped in a cache.
   *
   * Only pass this for data whose freshness is governed by the surrounding
   * cache's tags and TTL. Never for orders, buyer records or admin state.
   */
  cacheable?: boolean
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  // Named explicitly for the same reason as in ./public.ts: the client's own
  // error is a bare "supabaseUrl is required." from inside a bundled chunk.
  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SECRET_KEY']
      .filter(Boolean)
      .join(' and ')
    throw new Error(
      `Supabase admin client is not configured: ${missing} is not set. ` +
        'On Vercel, add it under Settings → Environment Variables and redeploy.'
    )
  }

  if (options?.cacheable) {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      /**
       * Opt every request out of Next's fetch Data Cache.
       *
       * Next patches global fetch in the App Router and caches GETs. PostgREST
       * reads are GETs, so without this a result is memoised against its URL —
       * and a URL like `?id=eq.<uuid>` is perfectly stable.
       *
       * Nothing this client reads is ever safe to cache: orders, buyer emails,
       * admin state and draft products, all of which must be current. A cached
       * order row would mean an admin marking something delivered and watching
       * it stay pending.
       */
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}
