import 'server-only'

import { createAdminClient } from './supabase/admin'
import { one } from './utils'

export interface CheckoutView {
  order: {
    id: string
    buyer_email: string
    buyer_name: string | null
    amount: number | null
    currency: string
    status: 'pending' | 'delivered'
    created_at: string
    delivered_at: string | null
    checkout_expires_at: string | null
  }
  product: {
    slug: string
    title: string
    file_type: string | null
    file_size_mb: number | null
    preview_image_url: string | null
  } | null
  expired: boolean
}

/**
 * Loads one checkout by its token.
 *
 * Read with the secret key from a server component. `manual_orders` has no public
 * policy and no column grant for the anon role — buyer email addresses live there
 * — so the token is validated here rather than by RLS, and the browser never gets
 * a client capable of querying the table at all.
 *
 * A token that does not match returns null, and the page 404s. There is
 * deliberately no distinction between "never existed" and "belongs to someone
 * else": both are simply not found.
 */
export async function getCheckout(token: string): Promise<CheckoutView | null> {
  // Tokens are 48 hex characters. Rejecting anything else keeps junk out of the
  // query and makes a scan for valid tokens pointless.
  if (!/^[a-f0-9]{48}$/.test(token)) return null

  const { data, error } = await createAdminClient()
    .from('manual_orders')
    .select(
      `id, buyer_email, buyer_name, amount, currency, status, created_at, delivered_at,
       checkout_expires_at,
       products ( slug, title, file_type, file_size_mb, preview_image_url )`
    )
    .eq('checkout_token', token)
    .maybeSingle()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  const product = one<CheckoutView['product']>(row.products as never) ?? null

  const expiresAt = row.checkout_expires_at as string | null
  const expired =
    row.status === 'pending' && expiresAt !== null && new Date(expiresAt).getTime() < Date.now()

  return {
    order: {
      id: row.id as string,
      buyer_email: row.buyer_email as string,
      buyer_name: (row.buyer_name as string | null) ?? null,
      amount: row.amount === null ? null : Number(row.amount),
      currency: (row.currency as string) ?? 'USD',
      status: row.status as 'pending' | 'delivered',
      created_at: row.created_at as string,
      delivered_at: (row.delivered_at as string | null) ?? null,
      checkout_expires_at: expiresAt,
    },
    product: product && product.slug ? product : null,
    expired,
  }
}
