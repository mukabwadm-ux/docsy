import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Where an emailed access link lands.
 *
 * Handles the server-side token-hash flow (what createAccessLink builds) and, as a
 * fallback, a PKCE `code` — so a link from Supabase's own mailer still works if
 * one ever goes out that way.
 *
 * Completing either exchange proves the visitor received the email, which is what
 * confirms the address. Only then are guest orders attached to the account:
 * claiming before confirmation would let anyone inherit a stranger's purchase
 * history, and the files with it, by typing their address at checkout.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const errorDescription = url.searchParams.get('error_description')

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/account/login?error=${encodeURIComponent(reason)}`, url.origin))

  if (errorDescription) return fail(errorDescription)

  const supabase = createClient()
  let userId: string | null = null

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error || !data.user) return fail('link-expired')
    userId = data.user.id
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) return fail('link-expired')
    userId = data.user.id
  } else {
    return fail('link-expired')
  }

  const db = createAdminClient()
  const { data: user } = await db.auth.admin.getUserById(userId)
  const email = user?.user?.email ?? ''

  // A link can belong to someone with no profile yet — an admin, or an account
  // that predates this table. Give them one rather than dead-ending in a redirect
  // loop between the dashboard and the login page.
  const { data: profile } = await db
    .from('buyer_profiles')
    .select('id, must_set_password')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    await db.from('buyer_profiles').insert({
      id: userId,
      email,
      must_set_password: true,
    })
  }

  await db.rpc('claim_orders_for_user', { p_user_id: userId }).then(
    () => undefined,
    () => undefined
  )

  const needsPassword = !profile || (profile as { must_set_password: boolean }).must_set_password
  return NextResponse.redirect(
    new URL(needsPassword ? '/account/password?first=1' : '/account', url.origin)
  )
}
