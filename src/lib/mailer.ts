import 'server-only'

import nodemailer, { type Transporter } from 'nodemailer'

import { getConfigMany } from './config'

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

export interface SendOptions {
  /**
   * Blind-copy the owner, when a copy-to address is configured.
   *
   * Opt-in per message rather than applied inside sendMail, because the one thing
   * that must never be copied is a campaign: a send to two hundred people would
   * put two hundred copies in the owner's inbox and, on a shared mailbox, would
   * also leak the whole recipient list. Transactional senders pass this; the
   * campaign loop deliberately does not.
   */
  copyToOwner?: boolean
}

export type SendResult = { ok: true; via: MailTransport } | { ok: false; error: string }

export interface MailSettings {
  transport: MailTransport
  from: string | null
  /** Blind-copied on transactional mail only. Never on campaigns. */
  copyTo: string | null
  smtp: { host: string; port: number; user: string; pass: string; secure: boolean } | null
  resendKey: string | null
}

const KEYS = [
  'email.from',
  'email.copy_to',
  'email.smtp_host',
  'email.smtp_port',
  'email.smtp_user',
  'email.smtp_pass',
  'email.resend_api_key',
]

/**
 * Resolved mail settings, from the environment or the admin panel.
 *
 * Async because the values can now be set in Settings → Integrations. Every
 * caller already sits in a server component, an action or a route handler.
 */
export async function mailSettings(): Promise<MailSettings> {
  const c = await getConfigMany(KEYS)

  const host = c['email.smtp_host']
  const user = c['email.smtp_user']
  const pass = c['email.smtp_pass']
  const resendKey = c['email.resend_api_key']

  const port = Number(c['email.smtp_port'] ?? 587) || 587
  const secureOverride = process.env.SMTP_SECURE

  const smtp =
    host && user && pass
      ? {
          host,
          port,
          user,
          pass,
          /**
           * 465 is implicit TLS; 587 and 25 start in the clear and upgrade with
           * STARTTLS. Getting this backwards is the commonest SMTP mistake —
           * secure:true on 587 hangs until timeout rather than failing clearly.
           */
          secure: secureOverride ? secureOverride === 'true' : port === 465,
        }
      : null

  return {
    // SMTP wins: anyone who configured a mail server means to use it.
    transport: smtp ? 'smtp' : resendKey ? 'resend' : 'none',
    from: c['email.from'],
    copyTo: c['email.copy_to'],
    smtp,
    resendKey,
  }
}

export async function activeTransport(): Promise<MailTransport> {
  return (await mailSettings()).transport
}

export async function isMailConfigured(): Promise<boolean> {
  const s = await mailSettings()
  return s.transport !== 'none' && Boolean(s.from)
}

/** Shown in the admin UI, and specific about what is missing. */
export function mailSetupHint(): string {
  return 'Add a From address plus either SMTP details or a Resend key in Settings → Integrations.'
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

function smtpTransporter(smtp: NonNullable<MailSettings['smtp']>): Transporter {
  const { host, port, user, pass, secure } = smtp
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

async function sendViaSmtp(
  message: OutgoingEmail,
  settings: MailSettings,
  bcc: string | null
): Promise<SendResult> {
  try {
    await smtpTransporter(settings.smtp!).sendMail({
      from: settings.from!,
      to: message.to,
      // Blind, not cc: the buyer has no reason to see the shop's own address on
      // their receipt, and it invites replies to the wrong mailbox.
      ...(bcc ? { bcc } : {}),
      replyTo: settings.from!,
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

async function sendViaResend(
  message: OutgoingEmail,
  settings: MailSettings,
  bcc: string | null
): Promise<SendResult> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: settings.from,
        to: [message.to],
        ...(bcc ? { bcc: [bcc] } : {}),
        reply_to: settings.from,
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

export async function sendMail(
  message: OutgoingEmail,
  options: SendOptions = {}
): Promise<SendResult> {
  const settings = await mailSettings()
  if (!settings.from) return { ok: false, error: mailSetupHint() }

  /**
   * Skip the copy when it would go to the recipient anyway — the owner buying
   * from their own shop, or testing with the copy address. A message with the
   * same address in To and Bcc is delivered twice by most servers.
   */
  const bcc =
    options.copyToOwner &&
    settings.copyTo &&
    settings.copyTo.toLowerCase() !== message.to.toLowerCase()
      ? settings.copyTo
      : null

  switch (settings.transport) {
    case 'smtp':
      return sendViaSmtp(message, settings, bcc)
    case 'resend':
      return sendViaResend(message, settings, bcc)
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
export async function verifyTransport(): Promise<
  { ok: true; via: MailTransport } | { ok: false; error: string }
> {
  const settings = await mailSettings()
  if (settings.transport === 'none' || !settings.from) {
    return { ok: false, error: mailSetupHint() }
  }

  if (settings.transport === 'smtp') {
    try {
      await smtpTransporter(settings.smtp!).verify()
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
