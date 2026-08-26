import 'server-only'

import { createAdminClient } from './supabase/admin'
import { ensureBuyerAccount } from './buyer'
import { sendEmail, isEmailConfigured } from './email'
import { receiptEmail } from './email-templates'
import { describeExpiry } from './delivery'
import { fileTypeLabel } from './format'

/**
 * Sends the order confirmation: receipt, and on a first order the link that sets
 * up the buyer's account.
 *
 * One email rather than two. Somebody who has just paid should not have to
 * reconcile a receipt and a separate "welcome" arriving minutes apart in an
 * unpredictable order.
 *
 * Called after the checkout row exists. Failures are returned rather than thrown:
 * an order that was recorded but whose email did not send is recoverable from the
 * admin queue, whereas an exception here would lose the order the buyer already
 * believes they placed.
 */
export async function sendOrderConfirmation(checkoutToken: string): Promise<
  { ok: true; accountCreated: boolean } | { ok: false; error: string }
> {
  const db = createAdminClient()

  const { data, error } = await db
    .from('manual_orders')
    .select(
      `id, buyer_email, buyer_name, amount, currency, user_id, checkout_token,
       products ( title, file_type )`
    )
    .eq('checkout_token', checkoutToken)
    .maybeSingle()

  if (error || !data) return { ok: false, error: 'Order not found.' }

  const row = data as {
    id: string
    buyer_email: string
    buyer_name: string | null
    amount: number | null
    currency: string
    user_id: string | null
    products?: { title: string; file_type: string | null } | { title: string; file_type: string | null }[]
  }
  const product = Array.isArray(row.products) ? row.products[0] : row.products

  /**
   * Account first, so the confirmation can carry the access link. An existing
   * buyer gets no link — they already have a password — and their guest orders
   * are attached to the account at the same time.
   */
  const account = await ensureBuyerAccount(row.buyer_email, row.buyer_name)
  if ('error' in account) return { ok: false, error: account.error }

  if (!row.user_id) {
    await db.from('manual_orders').update({ user_id: account.userId }).eq('id', row.id)
  }

  if (!isEmailConfigured()) {
    // The account and the link still exist; only the sending is unavailable.
    return { ok: false, error: 'Email is not configured, so no confirmation was sent.' }
  }

  const amount = Number(row.amount ?? 0)
  const message = receiptEmail({
    buyerName: row.buyer_name,
    lines: [
      {
        title: product?.title ?? 'Digital download',
        fileType: product?.file_type ? fileTypeLabel(product.file_type) : null,
        amount,
        currency: row.currency,
      },
    ],
    total: amount,
    currency: row.currency,
    // Short, human-quotable, and not the checkout token — that token is a
    // credential and must not end up pasted into a support thread.
    reference: `DCS-${row.id.slice(0, 8).toUpperCase()}`,
    downloadUrl: null,
    expiresIn: describeExpiry(),
    accessLink: account.accessLink,
  })

  const sent = await sendEmail(
    { to: row.buyer_email, ...message },
    { copyToOwner: true }
  )
  if (!sent.ok) return { ok: false, error: sent.error }

  return { ok: true, accountCreated: account.created }
}
