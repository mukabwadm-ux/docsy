import { NextResponse } from 'next/server'
import { fulfilPaidOrder } from '@/lib/fulfilment'
import { fromSubunit, verifyWebhookSignature } from '@/lib/paystack'

/**
 * Paystack webhook. The authoritative path for confirming a payment.
 *
 * The buyer being redirected back is convenient but unreliable — they close the
 * tab, lose signal, or pay on a phone and never return. This fires
 * server-to-server regardless, which is why it, and not the redirect, is what the
 * shop trusts.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  /**
   * Read the raw body, not request.json().
   *
   * The signature is an HMAC over these exact bytes. Parsing and re-serialising
   * changes key order and whitespace, and the signature then never matches — a
   * failure that looks like a Paystack problem and is not.
   */
  const raw = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!(await verifyWebhookSignature(raw, signature))) {
    /**
     * 401 and stop. Without this check, anyone who knows the URL could post a
     * forged charge.success and be sent a paid product for free — the signature
     * is the only thing separating this endpoint from a free-download button.
     */
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let event: {
    event?: string
    data?: { reference?: string; amount?: number; currency?: string; status?: string }
  }
  try {
    event = JSON.parse(raw)
  } catch {
    return new NextResponse('Malformed body', { status: 400 })
  }

  // Only successful charges matter. Everything else is acknowledged so Paystack
  // stops retrying it.
  if (event.event !== 'charge.success' || !event.data?.reference) {
    return NextResponse.json({ received: true, ignored: event.event ?? 'unknown' })
  }

  const result = await fulfilPaidOrder({
    reference: event.data.reference,
    amount: fromSubunit(event.data.amount ?? 0),
    currency: (event.data.currency ?? 'KES').toUpperCase(),
    meta: event.data as Record<string, unknown>,
  })

  /**
   * Always 200 once the signature is valid, even when delivery failed.
   *
   * A non-2xx makes Paystack retry, and a retry cannot fix a missing product file
   * or a broken mail server — it would repeat the same failure on a schedule. The
   * order is already recorded as paid and appears in the admin queue as
   * undelivered, which is where a person can act on it.
   */
  return NextResponse.json({
    received: true,
    transitioned: result.transitioned,
    delivered: result.delivered,
  })
}
