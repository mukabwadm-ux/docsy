import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous, cookie-free client for reading the public catalog from Server
 * Components.
 *
 * Deliberately NOT the cookie-bound server client: touching cookies() opts a
 * route out of static rendering, and the catalog and product pages are meant to
 * be statically generated with ISR. This client sees exactly what a logged-out
 * visitor sees, which is all those pages need.
 */
export const publicDb = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      /**
       * Catalog reads may be cached, but bounded. Next's default for a patched
       * fetch is to cache indefinitely, which would leave a product page
       * serving last week's price long after its ISR window elapsed. Pin the
       * fetch cache to the same 60s the pages revalidate on.
       */
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: 60 } } as RequestInit),
    },
  }
)
