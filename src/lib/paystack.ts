import 'server-only'

import crypto from 'node:crypto'

/**
 * Paystack, over the REST API.
 *
 * Chosen because it settles KES to a Kenyan bank account and takes M-Pesa, cards
 * and bank transfer through one integration — and the same integration accepts
 * international cards, so both audiences are covered without a second gateway.
 *
 * No card data reaches Docsy. The buyer is sent to Paystack's hosted page, enters
 * their details there, and comes back with a reference. That is what keeps this
 * shop out of PCI scope entirely.
 */

const API = 'https://api.paystack.co'

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

export const PAYSTACK_SETUP_HINT =
  'Add PAYSTACK_SECRET_KEY (and PAYSTACK_PUBLIC_KEY) to take card and M-Pesa payments.'

/** Paystack works in the currency's smallest unit — cents, not units. */
export function toSubunit(amount: number): number {
  return Math.round(amount * 100)
}

export function fromSubunit(subunit: number): number {
  return Math.round(subunit) / 100
}

interface InitInput {
  email: string
  /** In major units; converted here so no call site has to remember. */
  amount: number
  currency: 'USD' | 'KES'
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

export async function initializeTransaction(
  input: InitInput
): Promise<{ ok: true; authorizationUrl: string; reference: string } | { ok: false; error: string }> {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { ok: false, error: PAYSTACK_SETUP_HINT }

  try {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        amount: toSubunit(input.amount),
        currency: input.currency,
        // Our own reference, so the order can be found again from a webhook that
        // arrives before the buyer is redirected back.
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata ?? {},
      }),
      signal: AbortSignal.timeout(20000),
    })

    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean
      message?: string
      data?: { authorization_url?: string; reference?: string }
    }

    if (!res.ok || !body.status || !body.data?.authorization_url) {
      /**
       * Surface Paystack's own message. "Currency not supported by merchant" and
       * "Invalid key" need completely different fixes, and a generic failure
       * would send someone hunting through the wrong settings.
       */
      return { ok: false, error: body.message ?? `Paystack returned HTTP ${res.status}` }
    }

    return {
      ok: true,
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference ?? input.reference,
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, error: `Could not reach Paystack (${reason}).` }
  }
}

export interface VerifiedCharge {
  reference: string
  status: string
  paid: boolean
  amount: number
  currency: string
  raw: Record<string, unknown>
}

/**
 * Asks Paystack what actually happened.
 *
 * Always called before a payment is honoured, even when the buyer returns with a
 * success-looking URL. That redirect is just a browser navigation and can be
 * forged by typing it; only Paystack's own answer decides whether money moved.
 */
export async function verifyTransaction(
  reference: string
): Promise<{ ok: true; charge: VerifiedCharge } | { ok: false; error: string }> {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { ok: false, error: PAYSTACK_SETUP_HINT }

  try {
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
      // Verification must never read a cached answer.
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })

    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean
      message?: string
      data?: { status?: string; amount?: number; currency?: string; reference?: string }
    }

    if (!res.ok || !body.status || !body.data) {
      return { ok: false, error: body.message ?? `Paystack returned HTTP ${res.status}` }
    }

    return {
      ok: true,
      charge: {
        reference: body.data.reference ?? reference,
        status: body.data.status ?? 'unknown',
        paid: body.data.status === 'success',
        amount: fromSubunit(body.data.amount ?? 0),
        currency: (body.data.currency ?? 'KES').toUpperCase(),
        raw: body.data as Record<string, unknown>,
      },
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, error: `Could not reach Paystack (${reason}).` }
  }
}

/**
 * Verifies a webhook came from Paystack.
 *
 * HMAC-SHA512 of the raw request body, keyed with the secret. The raw bytes
 * matter: re-serialising the parsed JSON changes key order and whitespace, and
 * the signature stops matching for reasons that look like a Paystack bug.
 *
 * timingSafeEqual rather than === so the comparison does not leak, by how long it
 * takes, how much of a forged signature was correct.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key || !signature) return false

  const expected = crypto.createHmac('sha512', key).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Docsy's own reference for an order. Readable in the Paystack dashboard. */
export function buildReference(orderId: string): string {
  return `DCS-${orderId.replace(/-/g, '').slice(0, 20).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
}
