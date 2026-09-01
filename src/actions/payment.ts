'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCheckout } from '@/lib/checkout'
import { convert, getRates } from '@/lib/currency'
import { fulfilPaidOrder } from '@/lib/fulfilment'
import {
  buildReference,
  initializeTransaction,
  isPaystackConfigured,
  PAYSTACK_SETUP_HINT,
  verifyTransaction,
} from '@/lib/paystack'

export interface PaymentState {
  status: 'idle' | 'error'
  message?: string
}

/**
 * Starts a payment for an open checkout and sends the buyer to Paystack.
 *
 * The amount comes from the order row, never from the form. It was snapshotted
 * when the checkout was created, in the currency the buyer was shown, so what
 * they are charged is what they agreed to and nothing posted from a browser can
 * change it.
 */
export async function startPayment(
  _prev: PaymentState,
  formData: FormData
): Promise<PaymentState> {
  const token = String(formData.get('token') ?? '')
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return { status: 'error', message: 'That checkout link is not valid.' }
  }

  /**
   * Fetched together rather than in sequence.
   *
   * Neither depends on the other, and this runs while the buyer is staring at a
   * spinner having already decided to pay — the slowest possible moment to spend
   * an avoidable round trip. The key check is free (it resolves from the
   * environment), so the saving is the rate lookup overlapping the order read.
   */
  const [configured, checkout, rates] = await Promise.all([
    isPaystackConfigured(),
    getCheckout(token),
    getRates(),
  ])

  if (!configured) {
    return { status: 'error', message: PAYSTACK_SETUP_HINT }
  }

  if (!checkout) return { status: 'error', message: 'We could not find that order.' }
  if (checkout.expired) {
    return { status: 'error', message: 'This checkout has expired. Please start again.' }
  }
  if (checkout.order.paymentStatus === 'paid') {
    return { status: 'error', message: 'This order has already been paid.' }
  }

  const amount = Number(checkout.order.amount ?? 0)
  if (amount <= 0) {
    return { status: 'error', message: 'This order has no amount to charge.' }
  }

  /**
   * Everything is collected in KES.
   *
   * The account settles in Kenya, where USD has to be enabled separately; without
   * it Paystack rejects a USD charge outright with "Currency not supported by
   * merchant" - at the payment step, after the buyer has committed. Charging the
   * shilling equivalent always works, and a foreign card converts at the network's
   * own rate.
   *
   * The buyer still SEES the price in their own currency: `amount`/`currency` on
   * the order stay exactly as displayed, and only the charge is converted.
   */
  const chargeCurrency = 'KES' as const
  const chargeAmount =
    checkout.order.currency === 'KES' ? amount : convert(amount, 'KES', rates)

  if (chargeAmount <= 0) {
    return { status: 'error', message: 'This order has no amount to charge.' }
  }

  const db = createAdminClient()
  const reference = buildReference(checkout.order.id)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  /**
   * Store the reference before sending the buyer away.
   *
   * Paystack fires the webhook as soon as the charge succeeds, which can be
   * before the redirect completes. If the reference were saved afterwards, that
   * webhook would look up an order that does not exist yet and the payment would
   * be recorded against nothing.
   */
  const { error } = await db
    .from('manual_orders')
    .update({
      payment_provider: 'paystack',
      payment_reference: reference,
      payment_status: 'pending',
      // What the gateway is being asked for. mark_order_paid compares the settled
      // amount against this before releasing the file.
      charge_amount: chargeAmount,
      charge_currency: chargeCurrency,
    })
    .eq('id', checkout.order.id)

  if (error) {
    return { status: 'error', message: 'Could not start the payment. Please try again.' }
  }

  const init = await initializeTransaction({
    email: checkout.order.buyer_email,
    amount: chargeAmount,
    currency: chargeCurrency,
    reference,
    callbackUrl: `${siteUrl}/checkout/${token}?verify=1`,
    metadata: {
      order_id: checkout.order.id,
      product: checkout.product?.title ?? 'Digital download',
      checkout_token: token,
    },
  })

  if (!init.ok) {
    // Roll back to unpaid so a retry is not blocked by a pending state that never
    // became a real transaction.
    await db
      .from('manual_orders')
      .update({ payment_status: 'unpaid', payment_reference: null })
      .eq('id', checkout.order.id)
    return { status: 'error', message: init.error }
  }

  redirect(init.authorizationUrl)
}

/**
 * Confirms a payment when the buyer is redirected back.
 *
 * Belt and braces alongside the webhook: this makes the download appear
 * immediately for the buyer who does return, while the webhook covers the one who
 * does not. Both go through fulfilPaidOrder, which is safe to call twice.
 *
 * The redirect proves nothing on its own — it is a URL the buyer could type — so
 * Paystack is asked directly what happened before anything is honoured.
 */
export async function confirmPayment(token: string): Promise<{ paid: boolean; message: string }> {
  const checkout = await getCheckout(token)
  if (!checkout?.order.paymentReference) {
    return { paid: false, message: 'No payment to confirm for this order.' }
  }
  if (checkout.order.paymentStatus === 'paid') {
    return { paid: true, message: 'Payment confirmed.' }
  }

  const verified = await verifyTransaction(checkout.order.paymentReference)
  if (!verified.ok) return { paid: false, message: verified.error }

  if (!verified.charge.paid) {
    await createAdminClient()
      .from('manual_orders')
      .update({ payment_status: verified.charge.status === 'abandoned' ? 'unpaid' : 'failed' })
      .eq('id', checkout.order.id)
    return { paid: false, message: `Paystack reports the payment as ${verified.charge.status}.` }
  }

  /**
   * The buyer is watching the checkout page render right now, so the payment is
   * recorded before returning and the download email follows the response. The
   * webhook path deliberately does not defer - nothing is waiting on it there.
   */
  const result = await fulfilPaidOrder(
    {
      reference: verified.charge.reference,
      amount: verified.charge.amount,
      currency: verified.charge.currency,
      meta: verified.charge.raw,
    },
    { deferDelivery: true }
  )

  /**
   * A mismatch is not a completed purchase. Paystack says money moved, so the
   * charge did succeed — but it did not cover the order, nothing was delivered,
   * and telling the buyer "payment confirmed" would promise a file that is never
   * coming. The order is flagged in the admin queue for a person to settle.
   */
  if (result.mismatch) {
    return {
      paid: false,
      message:
        'We received a payment, but it does not match the amount for this order. Nothing has been charged again — we are looking into it and will email you.',
    }
  }

  return { paid: true, message: result.message }
}
