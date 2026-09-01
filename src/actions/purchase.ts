'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmation } from '@/lib/order-email'
import { CURRENCY_COOKIE, convert, getRates, resolveCurrency } from '@/lib/currency'
import { afterResponse } from '@/lib/after'

/**
 * Opens a checkout and sends the buyer to it.
 *
 * Email is the only required field. A digital download needs exactly one thing to
 * be deliverable — an address to send it to — and every extra required box on a
 * $19 impulse purchase is another chance to abandon.
 *
 * The order row is created here, before payment, on purpose. It means an
 * interrupted checkout is a row we already have: recoverable by URL, and
 * followable up by email. Nothing about a card is stored, now or later — a
 * gateway tokenises that in the browser and we keep only its reference.
 */

const schema = z.object({
  productId: z.string().uuid('Something went wrong — please reload the page.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email — this is where your file goes.')
    .max(160),
  name: z.string().trim().max(80, 'That name is too long.').optional(),
  note: z.string().trim().max(500, 'Please keep the note under 500 characters.').optional(),
})

export interface PurchaseState {
  status: 'idle' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'name' | 'email' | 'note', string>>
}

export async function requestPurchase(
  _prev: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const parsed = schema.safeParse({
    productId: formData.get('productId'),
    email: formData.get('email'),
    name: formData.get('name') || undefined,
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: PurchaseState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'email' || key === 'note') {
        fieldErrors[key] ??= issue.message
      }
    }
    const productIssue = parsed.error.issues.find((i) => i.path[0] === 'productId')
    return { status: 'error', fieldErrors, message: productIssue?.message }
  }

  const { productId, email, name, note } = parsed.data

  /**
   * Resolve the currency the buyer is actually looking at, then snapshot it onto
   * the order along with the rate that produced it.
   *
   * Read here rather than accepted from the form: a posted currency or amount is
   * a suggestion, and this is the number the buyer will be charged. The rate is
   * stored too, so the arithmetic on a receipt can be re-checked later against
   * the rate in force at the time rather than today's.
   */
  const rates = await getRates()
  const currency = resolveCurrency(
    headers().get('x-vercel-ip-country') ?? headers().get('cf-ipcountry'),
    cookies().get(CURRENCY_COOKIE)?.value,
    rates.geoPricingEnabled
  )

  /**
   * One round trip. open_checkout reads the price itself, refuses products that
   * are not active, and returns the existing token when this buyer already has
   * an open checkout for this product — so a double tap or a reload cannot
   * produce two pending orders for one purchase.
   */
  const db = createAdminClient()
  const { data: token, error } = await db.rpc('open_checkout', {
    p_product_id: productId,
    p_email: email,
    p_name: name ?? null,
    p_note: note ?? null,
  })

  if (error) {
    return { status: 'error', message: 'We could not start your order. Please try again.' }
  }
  if (!token) {
    return { status: 'error', message: 'This product is no longer available.' }
  }

  /**
   * open_checkout() writes the USD price. Convert it for display and record all
   * three numbers: what they pay, its USD equivalent, and the rate between them.
   * Revenue everywhere sums base_amount, so a KES order never has to be
   * back-converted at a later, different rate.
   */
  const { data: order } = await db
    .from('manual_orders')
    .select('id, amount, base_amount')
    .eq('checkout_token', token)
    .maybeSingle()

  if (order) {
    const row = order as { id: string; amount: number | null; base_amount: number | null }
    const usd = Number(row.base_amount ?? row.amount ?? 0)
    await db
      .from('manual_orders')
      .update({
        base_amount: usd,
        fx_rate: currency === 'KES' ? rates.usdToKes : 1,
        amount: convert(usd, currency, rates),
        currency,
      })
      .eq('id', row.id)
  }

  /**
   * Create the account and send the receipt, but do not make the buyer wait.
   *
   * This was awaited, and an SMTP send takes about five seconds — five seconds of
   * spinner between pressing the button and reaching the payment page, for an
   * email they open later in another tab. Nothing on the checkout page depends on
   * it having been sent.
   *
   * It is handed to afterResponse rather than fired loose. An unawaited promise in
   * a server action really can be cut short when the response is sent, which was
   * the original reason for awaiting it; afterResponse keeps the invocation alive
   * until the send settles, so the message is not traded away for the speed.
   *
   * A failure is still not surfaced to the buyer: their order exists and is
   * visible in the admin queue, so the recoverable outcome is the checkout page
   * rather than an error suggesting the purchase failed.
   */
  afterResponse(sendOrderConfirmation(token).catch(() => undefined))

  // redirect() throws, so it must sit outside the try/catch above and be the
  // last thing this action does.
  redirect(`/checkout/${token}`)
}
