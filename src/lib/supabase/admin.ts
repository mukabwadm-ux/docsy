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
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not configured')

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
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
