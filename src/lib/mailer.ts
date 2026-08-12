import 'server-only'

import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Mail transport, chosen at runtime.
 *
 * Two options, because they suit different situations rather than because one is
 * faster:
 *
 *   SMTP   — your own mail server or hosting account. Nothing sits between the
 *            app and the mail server, and there is no third-party plan to
 *            outgrow. Needs SMTP_HOST, SMTP_USER and SMTP_PASS.
 *   Resend — an HTTP API. Nothing to configure beyond a key, and it handles
 *            retries and bounce webhooks for you. Needs RESEND_API_KEY.
 *
 * SMTP wins if both are set, on the assumption that anyone who took the trouble
 * to configure a mail server means to use it.
 *
 * Worth being clear about what changing transport does and does not fix: once a
 * message is accepted, how quickly it lands is decided by the receiving provider
 * and by whether your domain passes SPF, DKIM and DMARC. Gmail delays mail from
 * senders it does not recognise regardless of how it arrived. Transport affects
 * the hand-off, not the delivery.
 */

export type MailTransport = 'smtp' | 'resend' | 'none'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

export type SendResult = { ok: true; via: MailTransport } | { ok: false; error: string }

export function activeTransport(): MailTransport {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp'
  if (process.env.RESEND_API_KEY) return 'resend'
  return 'none'
}

/** Address every message is sent from, and replies go back to. */
function fromAddress(): string | null {
  return process.env.EMAIL_FROM ?? null
}

export function isMailConfigured() {
  return activeTransport() !== 'none' && Boolean(fromAddress())
}

/** Shown in the admin UI, and specific about what is missing. */
export function mailSetupHint(): string {
  if (!fromAddress()) {
    return 'Set EMAIL_FROM (e.g. "Docsy <hello@docsy.imprinnt.co>") to send email.'
  }
  return 'Set SMTP_HOST, SMTP_USER and SMTP_PASS to send over your own mail server, or RESEND_API_KEY to send over Resend.'
}

/**
 * One transporter, reused.
 *
 * Building a transporter per message opens a fresh TCP and TLS connection every
 * time, which is the slowest part of an SMTP send by a wide margin. Nodemailer's
 * pool keeps connections warm between sends, which is what makes sending to a
 * campaign list at all reasonable.
 */
let cachedTransporter: Transporter | null = null
let cachedKey = ''

function smtpTransporter(): Transporter {
  const host = process.env.SMTP_HOST!
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER!
  const pass = process.env.SMTP_PASS!

  /**
   * 465 is implicit TLS; 587 and 25 start in the clear and upgrade with STARTTLS.
   * Getting this backwards is the single most common SMTP misconfiguration —
   * `secure: true` on 587 hangs until it times out rather than failing clearly.
   */
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465

  const key = `${host}:${port}:${secure}:${user}`
  if (cachedTransporter && cachedKey === key) return cachedTransporter

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    // Most shared hosts cap messages per connection; recycling avoids a silent
    // mid-campaign stall.
    maxMessages: 50,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })
  cachedKey = key
  return cachedTransporter
}

async function sendViaSmtp(message: OutgoingEmail): Promise<SendResult> {
  try {
    await smtpTransporter().sendMail({
      from: fromAddress()!,
      to: message.to,
      replyTo: fromAddress()!,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    return { ok: true, via: 'smtp' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    // A rejected recipient and a wrong password both land here; the message from
    // the server is the only thing that distinguishes them, so pass it through.
    return { ok: false, error: `SMTP: ${reason}` }
  }
}

async function sendViaResend(message: OutgoingEmail): Promise<SendResult> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        reply_to: fromAddress(),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { message?: string }
        if (body?.message) detail = body.message
      } catch {
        /* keep the status code */
      }
      return { ok: false, error: `Resend: ${detail}` }
    }
    return { ok: true, via: 'resend' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, error: `Resend: could not reach the API (${reason})` }
  }
}

export async function sendMail(message: OutgoingEmail): Promise<SendResult> {
  if (!fromAddress()) return { ok: false, error: mailSetupHint() }

  switch (activeTransport()) {
    case 'smtp':
      return sendViaSmtp(message)
    case 'resend':
      return sendViaResend(message)
    default:
      return { ok: false, error: mailSetupHint() }
  }
}

/**
 * Proves the SMTP credentials work without sending anything.
 *
 * Worth having its own button in the admin panel: an SMTP problem otherwise
 * surfaces as a failed delivery to a real buyer, and "wrong port" and "wrong
 * password" look identical from there.
 */
export async function verifyTransport(): Promise<{ ok: true; via: MailTransport } | { ok: false; error: string }> {
  const transport = activeTransport()
  if (transport === 'none' || !fromAddress()) return { ok: false, error: mailSetupHint() }

  if (transport === 'smtp') {
    try {
      await smtpTransporter().verify()
      return { ok: true, via: 'smtp' }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error'
      return { ok: false, error: `SMTP: ${reason}` }
    }
  }

  // Resend has no verify endpoint; a key that is present is as much as can be
  // checked without sending a message.
  return { ok: true, via: 'resend' }
}
