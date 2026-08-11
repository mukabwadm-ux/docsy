import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'

export interface BuyerSession {
  userId: string
  email: string
  fullName: string | null
  mustSetPassword: boolean
  marketingOptIn: boolean
}

/**
 * Resolves the signed-in buyer, or null.
 *
 * A buyer is an auth user with a row in buyer_profiles. Admins are a separate
 * table, so the two cannot be confused: an admin session does not grant a
 * customer dashboard, and a buyer session does not grant /admin.
 */
export async function getBuyerSession(): Promise<BuyerSession | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser()
  if (!user) return null

  const { data } = await createAdminClient()
    .from('buyer_profiles')
    .select('id, email, full_name, must_set_password, marketing_opt_in')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null

  const row = data as {
    id: string
    email: string
    full_name: string | null
    must_set_password: boolean
    marketing_opt_in: boolean
  }

  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    mustSetPassword: row.must_set_password,
    marketingOptIn: row.marketing_opt_in,
  }
}

/**
 * Guard for every buyer page.
 *
 * Two redirects, in order. Not signed in goes to login. Signed in but still
 * carrying must_set_password goes to the set-password screen — every time, from
 * every page, until a password is chosen. Enforcing it per page rather than once
 * at sign-in is what stops the requirement being skipped by navigating straight
 * to a URL.
 */
export async function requireBuyer(nextPath?: string): Promise<BuyerSession> {
  const session = await getBuyerSession()
  if (!session) {
    const target = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
    redirect(`/account/login${target}`)
  }
  if (session.mustSetPassword) redirect('/account/password?first=1')
  return session
}

/** For pages that are themselves part of finishing setup. */
export async function requireBuyerAllowingSetup(): Promise<BuyerSession> {
  const session = await getBuyerSession()
  if (!session) redirect('/account/login')
  return session
}

/**
 * Creates a buyer account for an email, or returns the existing one.
 *
 * No password is ever generated or transmitted. The buyer receives a one-time
 * link, and sets their own password on arrival.
 *
 * Emailing a temporary password would mean a working credential sitting in an
 * inbox indefinitely, readable by anything with access to that mailbox and
 * copied into every forward and backup of it. A link that expires and can only
 * be used once achieves the same outcome — the buyer gets in from their email
 * and chooses a password — without ever putting a live credential in a message.
 */
export async function ensureBuyerAccount(
  email: string,
  fullName?: string | null
): Promise<
  | { created: boolean; userId: string; accessLink: string | null }
  | { error: string }
> {
  const db = createAdminClient()
  const normalised = email.trim().toLowerCase()

  const existing = await findAuthUserByEmail(normalised)

  if (existing) {
    // Already has an account. Attach any orders placed as a guest, and hand back
    // no link — an existing buyer signs in normally.
    await db.rpc('claim_orders_for_user', { p_user_id: existing.id }).then(
      () => undefined,
      () => undefined
    )
    return { created: false, userId: existing.id, accessLink: null }
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: normalised,
    // Deliberately unconfirmed. Clicking the emailed link is what proves the
    // address belongs to them, and order claiming depends on that proof.
    email_confirm: false,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  })

  if (createError || !created.user) {
    return { error: createError?.message ?? 'Could not create the account.' }
  }

  const { error: profileError } = await db.from('buyer_profiles').insert({
    id: created.user.id,
    email: normalised,
    full_name: fullName ?? null,
    must_set_password: true,
  })

  if (profileError) {
    // Leaving an auth user with no profile would make the account unusable and
    // invisible: getBuyerSession would reject it and nothing would list it.
    await db.auth.admin.deleteUser(created.user.id).catch(() => undefined)
    return { error: profileError.message }
  }

  const link = await createAccessLink(normalised, 'invite')
  return { created: true, userId: created.user.id, accessLink: link }
}

/**
 * Generates a single-use sign-in link without sending anything.
 *
 * Supabase's own mailer is rate-limited and not configured for this project, so
 * every message goes out through Resend instead — which also keeps the receipt
 * and the access link in one email rather than two arriving minutes apart.
 */
export async function createAccessLink(
  email: string,
  type: 'invite' | 'recovery' | 'magiclink'
): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type,
    email: email.trim().toLowerCase(),
    options: { redirectTo: `${siteUrl}/account/callback` },
  })

  if (error || !data?.properties?.hashed_token) return null

  /**
   * Built from `hashed_token`, not the `action_link` Supabase also returns.
   *
   * action_link points at Supabase's own verify endpoint, which completes the
   * implicit flow and hands the session back in a URL fragment. Our server client
   * uses PKCE, so it has no code verifier for a link it did not initiate — and
   * exchangeCodeForSession fails with "link expired", which looks like a broken
   * email rather than the flow mismatch it is.
   *
   * Sending the token hash to our own callback lets the server call verifyOtp,
   * which is the server-side counterpart and sets the session as a cookie.
   */
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type,
  })
  return `${siteUrl}/account/callback?${params}`
}

/** listUsers is paginated; walk it rather than assuming page one. */
async function findAuthUserByEmail(email: string) {
  const db = createAdminClient()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}
