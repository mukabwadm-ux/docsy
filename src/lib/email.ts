import 'server-only'

/**
 * Transactional email via Resend's REST API.
 *
 * Called with fetch rather than the SDK: this sends exactly one kind of message,
 * and a single POST is less to keep current than a dependency.
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
 * Sends one message. Every template funnels through here, so retries, timeouts
 * and error shaping exist once.
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
        reply_to: from,
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
      return { ok: false, error: detail }
    }
    return { ok: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, error: `Could not reach the email service (${reason}).` }
  }
}

interface DeliveryEmail {
  to: string
  buyerName: string | null
  productTitle: string
  downloadUrl: string
  expiresIn: string
  fileTypeLabel?: string | null
}

export async function sendDeliveryEmail(
  input: DeliveryEmail
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return { ok: false, error: EMAIL_SETUP_HINT }

  const firstName = input.buyerName?.trim().split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        // Replies land wherever EMAIL_FROM is hosted, which is what the copy
        // promises — "reply to this email" has to actually reach someone.
        reply_to: from,
        subject: `Your download: ${input.productTitle}`,
        text: plainText(input, greeting),
        html: html(input, greeting),
      }),
      // A hung mail API must not hold the admin's request open indefinitely.
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      // Resend returns a JSON body with a message on failure; surface it, since
      // "domain not verified" and "invalid key" need very different fixes.
      let detail = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { message?: string; name?: string }
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

function plainText({ productTitle, downloadUrl, expiresIn, fileTypeLabel }: DeliveryEmail, greeting: string) {
  return [
    greeting,
    '',
    `Thanks for your order. Here is your download for ${productTitle}:`,
    '',
    downloadUrl,
    '',
    `The link works for ${expiresIn}${fileTypeLabel ? ` and gives you the ${fileTypeLabel}` : ''}. Save the file somewhere safe once you have it.`,
    '',
    'If anything is wrong with it, just reply to this email and we will sort it out.',
    '',
    'Thanks,',
    'Docsy',
  ].join('\n')
}

/**
 * Table-based layout with inline styles. Email clients — Outlook especially —
 * strip <style> blocks and have no useful flexbox support, so anything more
 * modern falls apart in exactly the client most buyers use for receipts.
 */
function html({ productTitle, downloadUrl, expiresIn }: DeliveryEmail, greeting: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FFF6DB;font-family:Georgia,'Times New Roman',serif;color:#373737;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6DB;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #F6E3BB;border-radius:8px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <p style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:20px;color:#151515;">Docsy</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;">
                <h1 style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:1.15;text-transform:uppercase;color:#151515;">Your download is ready</h1>
                <p style="margin:16px 0 0;font-size:16px;line-height:1.6;">${escapeHtml(greeting)}</p>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">
                  Thanks for your order. Here is your copy of <strong>${escapeHtml(productTitle)}</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#EB2437;border-radius:6px;">
                      <a href="${escapeAttr(downloadUrl)}"
                         style="display:inline-block;padding:15px 30px;font-family:'Arial Narrow',Arial,sans-serif;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:16px;color:#ffffff;text-decoration:none;">
                        Download it now
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b;line-height:1.5;">
                  This link works for ${escapeHtml(expiresIn)}. Save the file somewhere safe once you have it.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;">
                <p style="margin:0;padding-top:20px;border-top:1px solid #F6E3BB;font-size:14px;line-height:1.6;color:#555;">
                  If anything is wrong with the file, or the link has expired, just reply to this
                  email — it reaches a person.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#8a8378;">You are receiving this because you ordered from Docsy.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Signed URLs carry & and = in the query string, so only quotes need handling. */
function escapeAttr(value: string) {
  return value.replace(/"/g, '&quot;')
}
