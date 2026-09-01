'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAccessLink, ensureBuyerAccount, getBuyerSession } from '@/lib/buyer'
import { createSignedDownloadUrl } from '@/lib/delivery'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { accessEmail } from '@/lib/email-templates'

export interface AccountState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
  /** Set by the download action so the browser can follow it. */
  url?: string
}

// ================================================================= sign in

/**
 * Password sign-in for a returning buyer.
 *
 * Deliberately vague on failure. Saying "no account with that email" tells anyone
 * who asks which addresses are registered, which is a list worth having if you
 * send phishing for a living.
 */
export async function buyerSignIn(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/account')

  if (!email || !password) {
    return { status: 'error', message: 'Enter your email and password.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { status: 'error', message: 'Those details do not match an account.' }
  }

  // An admin signing in here would have no buyer_profiles row and would bounce
  // around redirects; send them to their own area instead.
  const { data: profile } = await createAdminClient()
    .from('buyer_profiles')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.auth.signOut()
    return {
      status: 'error',
      message: 'That account is not a customer account. Admins sign in at /admin/login.',
    }
  }

  redirect(next.startsWith('/') ? next : '/account')
}

/**
 * Emails a single-use sign-in link.
 *
 * Also the "forgot password" path, and the way an account created at checkout is
 * first opened. Always reports success, whether or not the address has an
 * account — the response must not reveal which emails are registered.
 */
export async function requestAccessLink(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(160)
    .safeParse(formData.get('email'))

  if (!parsed.success) {
    return { status: 'error', fieldErrors: { email: 'Enter a valid email address.' } }
  }

  const email = parsed.data
  const generic: AccountState = {
    status: 'success',
    message: `If there is a Docsy account for ${email}, a sign-in link is on its way.`,
  }

  if (!(await isEmailConfigured())) {
    return { status: 'error', message: 'Email is not configured yet, so links cannot be sent.' }
  }

  const account = await ensureBuyerAccount(email)
  if ('error' in account) return generic

  const link = account.accessLink ?? (await createAccessLink(email, 'magiclink'))
  if (!link) return generic

  await sendEmail({ to: email, ...accessEmail({ accessLink: link, isNew: account.created }) }).catch(
    () => undefined
  )

  return generic
}

export async function buyerSignOut() {
  await createClient().auth.signOut()
  redirect('/')
}

// =============================================================== password

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'That password is too long.')

/**
 * Sets or changes the buyer's password, and clears must_set_password.
 *
 * The flag is cleared only after Supabase accepts the new password, so a failed
 * update leaves the buyer still required to set one rather than dropping them
 * into the dashboard with a password they never chose.
 */
export async function setBuyerPassword(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const session = await getBuyerSession()
  if (!session) return { status: 'error', message: 'Please sign in again.' }

  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) {
    return { status: 'error', fieldErrors: { password: parsed.error.issues[0].message } }
  }
  if (password !== confirm) {
    return { status: 'error', fieldErrors: { confirm: 'Those two do not match.' } }
  }

  const { error } = await createClient().auth.updateUser({ password })
  if (error) {
    return { status: 'error', message: error.message }
  }

  await createAdminClient()
    .from('buyer_profiles')
    .update({ must_set_password: false })
    .eq('id', session.userId)

  revalidatePath('/account')
  redirect('/account?welcome=1')
}

// ================================================================ profile

export async function updateBuyerProfile(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const session = await getBuyerSession()
  if (!session) return { status: 'error', message: 'Please sign in again.' }

  const fullName = String(formData.get('full_name') ?? '').trim().slice(0, 80)
  const optIn = formData.get('marketing_opt_in') === 'on'

  const { error } = await createAdminClient()
    .from('buyer_profiles')
    .update({
      full_name: fullName || null,
      marketing_opt_in: optIn,
      // Clearing the timestamp on re-opt-in matters: the campaign view filters on
      // both, so leaving it set would silently keep them excluded.
      unsubscribed_at: optIn ? null : new Date().toISOString(),
    })
    .eq('id', session.userId)

  if (error) return { status: 'error', message: error.message }

  revalidatePath('/account/settings')
  return { status: 'success', message: 'Saved.' }
}

// =============================================================== wishlist

export async function toggleWishlist(productId: string): Promise<AccountState> {
  const session = await getBuyerSession()
  if (!session) {
    return { status: 'error', message: 'Sign in to save products.' }
  }

  const db = createAdminClient()
  const { data: existing } = await db
    .from('wishlists')
    .select('id')
    .eq('user_id', session.userId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    await db.from('wishlists').delete().eq('id', (existing as { id: string }).id)
    revalidatePath('/account/wishlist')
    return { status: 'success', message: 'removed' }
  }

  const { error } = await db
    .from('wishlists')
    .insert({ user_id: session.userId, product_id: productId })

  // 23505 is the unique constraint doing its job under a double click. The row
  // exists either way, which is the outcome the buyer asked for.
  if (error && error.code !== '23505') {
    return { status: 'error', message: 'Could not save that. Please try again.' }
  }

  revalidatePath('/account/wishlist')
  return { status: 'success', message: 'saved' }
}

// ============================================================== downloads

/**
 * Mints a fresh download link for an order the signed-in buyer owns.
 *
 * Three conditions, all checked server-side: the order belongs to this user, it
 * has been delivered, and the product still has a file. Without the ownership
 * check this action would hand any file to any signed-in buyer who guessed an
 * order id — which is the entire paywall.
 */
export async function downloadPurchase(orderId: string): Promise<AccountState> {
  const session = await getBuyerSession()
  if (!session) return { status: 'error', message: 'Please sign in again.' }

  const { data, error } = await createAdminClient()
    .from('manual_orders')
    .select('id, status, user_id, products ( title, file_url )')
    .eq('id', orderId)
    .eq('user_id', session.userId)
    .maybeSingle()

  if (error || !data) return { status: 'error', message: 'Order not found.' }

  const row = data as {
    status: string
    products?: { file_url: string | null } | { file_url: string | null }[]
  }
  if (row.status !== 'delivered') {
    return { status: 'error', message: 'This order has not been delivered yet.' }
  }

  const product = Array.isArray(row.products) ? row.products[0] : row.products
  if (!product?.file_url) {
    return { status: 'error', message: 'The file for this product is unavailable — please contact us.' }
  }

  const signed = await createSignedDownloadUrl(product.file_url)
  if ('error' in signed) return { status: 'error', message: signed.error }

  return { status: 'success', url: signed.url }
}

// ============================================================ unsubscribe

/** One-click opt-out from an email footer. No sign-in required, by design. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(token)) return false

  const { error } = await createAdminClient()
    .from('buyer_profiles')
    .update({ marketing_opt_in: false, unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)

  return !error
}
