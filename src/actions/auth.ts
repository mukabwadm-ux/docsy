'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface LoginState {
  status: 'idle' | 'error'
  message?: string
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { status: 'error', message: 'Enter your email and password.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells an attacker which emails are registered.
    return { status: 'error', message: 'Those details do not match an account.' }
  }

  /**
   * Authenticating is not the same as being an admin. Anyone can sign up
   * against a public Supabase project, so membership in admin_users is what
   * actually grants access — and a non-admin who signs in here must be signed
   * straight back out rather than left holding a valid session cookie.
   */
  const { data: admin } = await createAdminClient()
    .from('admin_users')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!admin) {
    await supabase.auth.signOut()
    return { status: 'error', message: 'That account does not have admin access.' }
  }

  redirect('/admin')
}

export async function signOut() {
  await createClient().auth.signOut()
  redirect('/admin/login')
}
