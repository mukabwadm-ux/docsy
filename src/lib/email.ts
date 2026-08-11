import 'server-only'

import { deliveryEmail, type DeliveryEmailInput } from './email-templates'

/**
 * Transactional email via Resend's REST API.
 *
 * Called with fetch rather than the SDK: this sends one shape of request, and a
 * single POST is less to keep current than a dependency.
 *
 * All markup lives in ./email-templates, which owns the brand — colours, the
 * Oswald/Lora pairing, the logo and the footer. Nothing here builds HTML, so no
 * message can drift away from the rest.
 */

const ENDPOINT = 'https://api.resend.com/emails'

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

/** What to tell the admin when it is not set up, in the admin UI itself. */
export const EMAIL_SETUP_HINT =
  'Add RESEND_API_KEY and EMAIL_FROM to send delivery emails automatically.'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Sends one message. Every template funnels through here, so timeouts and error
 * shaping exist once.
 */
export async function sendEmail(
  message: OutgoingEmail
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return { ok: false, error: EMAIL_SETUP_HINT }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.to],
        // Replies land wherever EMAIL_FROM is hosted, which is what the copy
        // promises — "reply to this email" has to actually reach someone.
        reply_to: from,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      // A hung mail API must not hold open the request an admin is waiting on.
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      // Resend returns a JSON body with a message on failure; surface it, since
      // "domain not verified" and "invalid key" need very different fixes.
      let detail = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { message?: string }
        if (body?.message) detail = body.message
      } catch {
        /* keep the status code */
      }
      return { ok: false, error: detail }
    }
    return { ok: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, error: `Could not reach the email service (${reason}).` }
  }
}

/** Sends the fulfilment email for one order. */
export async function sendDeliveryEmail(
  input: DeliveryEmailInput & { to: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to, ...rest } = input
  return sendEmail({ to, ...deliveryEmail(rest) })
}
