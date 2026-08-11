import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'

export interface AdminSession {
  userId: string
  email: string
  role: string
}

/**
 * Resolves the current admin, or null.
 *
 * Two checks, not one: a valid Supabase session AND a row in `admin_users`.
 * Anyone can sign up against a public Supabase project, so authentication alone
 * grants nothing here — it proves who you are, not that you own the shop.
 *
 * The membership lookup goes through the secret-key client because the caller
 * may not yet be able to read the table under RLS.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: admin } = await createAdminClient()
    .from('admin_users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!admin) return null

  return { userId: user.id, email: user.email ?? '', role: admin.role ?? 'admin' }
}

/** Use at the top of every admin page. Redirects if not an admin. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return session
}

/**
 * Server-action variant. Returning null beats redirect() here: a redirect thrown
 * mid-action discards the form state and the user's typing along with it.
 */
export async function assertAdmin(): Promise<AdminSession | null> {
  return getAdminSession()
}
