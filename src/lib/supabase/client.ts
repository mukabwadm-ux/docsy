'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser client. Publishable key only — under the policies in migration 0003
 * it can read the active catalog and approved reviews, and nothing else.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
