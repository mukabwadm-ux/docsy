import 'server-only'

import { createAdminClient } from './supabase/admin'
import { createSignedDownloadUrl, describeExpiry } from './delivery'
import { isEmailConfigured, sendEmail } from './email'
import { deliveryEmail } from './email-templates'
import { fileTypeLabel } from './format'
import { one } from './utils'

export interface FulfilResult {
  /** True only for the call that actually made the transition. */
  transitioned: boolean
  delivered: boolean
  message: string
}

/**
 * Settles a paid order: records the payment, then sends the file.
 *
 * Called from two places that can race — Paystack's webhook and the buyer being
 * redirected back — and it is safe to call any number of times. mark_order_paid()
 * does the transition in a single guarded statement and reports whether this call
 * was the one that made it, so delivery happens exactly once even if both arrive
 * at the same instant. Without that, the buyer gets two emails and the sale is
 * counted twice.
 *
 * Payment is recorded before delivery is attempted. If the email fails, the money
 * is still recorded and the order shows as paid-but-undelivered in the admin
 * queue, which is a visible problem someone can fix. The reverse — a file sent
 * against a payment we failed to record — is invisible and unfixable.
 */
export async function fulfilPaidOrder(input: {
  reference: string
  amount: number
  currency: string
  meta?: Record<string, unknown>
}): Promise<FulfilResult> {
  const db = createAdminClient()

  const { data: transitioned, error } = await db.rpc('mark_order_paid', {
    p_reference: input.reference,
    p_amount: input.amount,
    p_currency: input.currency,
    p_meta: input.meta ?? null,
  })

  if (error) {
    return { transitioned: false, delivered: false, message: `Could not record payment: ${error.message}` }
  }

  if (!transitioned) {
    // Already settled by the other path. Nothing to do, and nothing wrong.
    return { transitioned: false, delivered: false, message: 'Already recorded.' }
  }

  const { data } = await db
    .from('manual_orders')
    .select('id, buyer_email, buyer_name, status, products ( title, file_url, file_type )')
    .eq('payment_reference', input.reference)
    .maybeSingle()

  if (!data) {
    return { transitioned: true, delivered: false, message: 'Payment recorded, but the order vanished.' }
  }

  const order = data as {
    id: string
    buyer_email: string
    buyer_name: string | null
    products?: unknown
  }
  const product = one<{ title: string; file_url: string | null; file_type: string | null }>(
    order.products as never
  )

  if (!product?.file_url) {
    return {
      transitioned: true,
      delivered: false,
      message: 'Paid, but the product has no file attached — deliver it by hand.',
    }
  }

  if (!isEmailConfigured()) {
    return {
      transitioned: true,
      delivered: false,
      message: 'Paid. Email is not configured, so send the file from the orders queue.',
    }
  }

  const signed = await createSignedDownloadUrl(product.file_url)
  if ('error' in signed) {
    return { transitioned: true, delivered: false, message: `Paid, but no download link: ${signed.error}` }
  }

  const sent = await sendEmail({
    to: order.buyer_email,
    ...deliveryEmail({
      buyerName: order.buyer_name,
      productTitle: product.title,
      downloadUrl: signed.url,
      expiresIn: describeExpiry(),
      fileTypeLabel: product.file_type ? fileTypeLabel(product.file_type) : null,
    }),
  })

  if (!sent.ok) {
    return { transitioned: true, delivered: false, message: `Paid, but the email failed: ${sent.error}` }
  }

  // Only now is the order fulfilled. The fulfilment flag moves last, so it never
  // claims a delivery that did not happen.
  await db
    .from('manual_orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', order.id)

  return { transitioned: true, delivered: true, message: 'Paid and delivered.' }
}
