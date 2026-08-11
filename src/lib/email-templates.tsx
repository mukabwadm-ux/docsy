import 'server-only'

/**
 * Email markup for Docsy.
 *
 * Plain string templates, not React. Email clients need table layout and inline
 * styles — Outlook strips <style> blocks and has no useful flexbox — and a
 * receipt is exactly the kind of message that gets read in Outlook.
 *
 * Every template goes through `shell()`, so the logo, footer and unsubscribe
 * handling exist in one place. A campaign template that forgot its unsubscribe
 * link would be a legal problem, not a formatting one.
 */

const BRAND = {
  cta: '#EB2437',
  cream: '#FFF6DB',
  tan: '#F6E3BB',
  heading: '#151515',
  body: '#373737',
  muted: '#6b6b6b',
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export interface ReceiptLine {
  title: string
  fileType?: string | null
  amount: number
  currency: string
}

function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const escapeAttr = (value: string) => value.replace(/"/g, '&quot;')

/**
 * The logo is drawn with a table cell and a text glyph rather than an image.
 *
 * Most clients block remote images by default, so an <img> logo means the top of
 * the email is an empty box for a large share of recipients. This renders
 * identically everywhere with nothing to download.
 */
function logo() {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td width="34" height="34" align="center" valign="middle"
          style="background:${BRAND.cta};border-radius:7px;color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">D</td>
      <td style="padding-left:10px;font-family:'Arial Narrow',Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${BRAND.heading};">Docsy</td>
    </tr>
  </table>`
}

interface ShellOptions {
  preheader: string
  body: string
  /** Present on campaign mail, absent on transactional mail. */
  unsubscribeToken?: string | null
}

function shell({ preheader, body, unsubscribeToken }: ShellOptions) {
  const unsubscribe = unsubscribeToken
    ? `<p style="margin:10px 0 0;font-family:Georgia,serif;font-size:12px;color:#8a8378;">
         You are receiving this because you have a Docsy account.
         <a href="${escapeAttr(siteUrl())}/unsubscribe/${escapeAttr(unsubscribeToken)}" style="color:#8a8378;">Unsubscribe</a>.
       </p>`
    : `<p style="margin:10px 0 0;font-family:Georgia,serif;font-size:12px;color:#8a8378;">
         You are receiving this because you placed an order with Docsy.
       </p>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:${BRAND.cream};">
    <!-- Preheader: the grey line clients show next to the subject. Left unset,
         they scrape the first words of the body, which is usually "Hi,". -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.tan};border-radius:10px;">
            <tr><td style="padding:28px 28px 0;">${logo()}</td></tr>
            ${body}
          </table>
          ${unsubscribe}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:${BRAND.cta};border-radius:6px;">
        <a href="${escapeAttr(href)}" style="display:inline-block;padding:15px 30px;font-family:'Arial Narrow',Arial,sans-serif;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:16px;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function receiptTable(lines: ReceiptLine[], total: number, currency: string, reference: string) {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.tan};font-family:Georgia,serif;font-size:15px;color:${BRAND.body};">
          ${escapeHtml(l.title)}
          ${l.fileType ? `<br /><span style="font-size:12px;color:${BRAND.muted};">${escapeHtml(l.fileType)}</span>` : ''}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.tan};font-family:'Arial Narrow',Arial,sans-serif;font-size:16px;font-weight:bold;color:${BRAND.heading};white-space:nowrap;">
          ${escapeHtml(money(l.amount, l.currency))}
        </td>
      </tr>`
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    <tr>
      <td colspan="2" style="padding-bottom:6px;font-family:'Arial Narrow',Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.muted};">
        Receipt · ${escapeHtml(reference)}
      </td>
    </tr>
    ${rows}
    <tr>
      <td style="padding:12px 0;font-family:'Arial Narrow',Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${BRAND.heading};">Total paid</td>
      <td align="right" style="padding:12px 0;font-family:'Arial Narrow',Arial,sans-serif;font-size:22px;font-weight:bold;color:${BRAND.heading};white-space:nowrap;">${escapeHtml(money(total, currency))}</td>
    </tr>
  </table>`
}

// ============================================================== transactional

export interface ReceiptEmailInput {
  buyerName: string | null
  lines: ReceiptLine[]
  total: number
  currency: string
  reference: string
  downloadUrl: string | null
  expiresIn: string
  /** Present only on a buyer's first order, when the account was just created. */
  accessLink?: string | null
}

/**
 * Receipt, download link and — on a first order — the link that sets up their
 * account. One message rather than three: a buyer who has just paid should not
 * have to reconcile several emails arriving in an unpredictable order.
 */
export function receiptEmail(input: ReceiptEmailInput) {
  const first = input.buyerName?.trim().split(' ')[0]
  const greeting = first ? `Hi ${escapeHtml(first)},` : 'Hi,'

  const downloadBlock = input.downloadUrl
    ? `<tr><td style="padding:22px 28px 0;">
         ${button(input.downloadUrl, 'Download your files')}
         <p style="margin:12px 0 0;font-family:Georgia,serif;font-size:13px;color:${BRAND.muted};">
           This link works for ${escapeHtml(input.expiresIn)}. Save the file somewhere safe once you have it.
         </p>
       </td></tr>`
    : `<tr><td style="padding:22px 28px 0;">
         <p style="margin:0;font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${BRAND.body};">
           Your download link follows shortly, in a separate email.
         </p>
       </td></tr>`

  const accessBlock = input.accessLink
    ? `<tr><td style="padding:24px 28px 0;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};border:1px solid ${BRAND.tan};border-radius:8px;">
           <tr><td style="padding:18px;">
             <p style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:${BRAND.heading};">Your Docsy account is ready</p>
             <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${BRAND.body};">
               We created an account so you can re-download anything you buy, any time. Set your
               password and it is yours — no password was emailed to you, and this link expires.
             </p>
             <div style="margin-top:14px;">${button(input.accessLink, 'Set your password')}</div>
           </td></tr>
         </table>
       </td></tr>`
    : ''

  const body = `
    <tr><td style="padding:20px 28px 0;">
      <h1 style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-size:27px;line-height:1.15;text-transform:uppercase;color:${BRAND.heading};">Thanks for your order</h1>
      <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.body};">${greeting}</p>
      <p style="margin:10px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.body};">
        Your order is confirmed. Here is your receipt.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 0;">${receiptTable(input.lines, input.total, input.currency, input.reference)}</td></tr>
    ${downloadBlock}
    ${accessBlock}
    <tr><td style="padding:24px 28px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.tan};font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#555;">
        Anything wrong with the file, or the link expired? Reply to this email — it reaches a person.
      </p>
    </td></tr>`

  return {
    subject: `Your Docsy receipt${input.lines[0] ? ` — ${input.lines[0].title}` : ''}`,
    html: shell({ preheader: `Receipt ${input.reference} · ${money(input.total, input.currency)}`, body }),
    text: [
      greeting.replace(/<[^>]*>/g, ''),
      '',
      'Your order is confirmed. Receipt:',
      '',
      ...input.lines.map((l) => `  ${l.title} — ${money(l.amount, l.currency)}`),
      `  Total: ${money(input.total, input.currency)}`,
      `  Reference: ${input.reference}`,
      '',
      input.downloadUrl
        ? `Download (works for ${input.expiresIn}):\n${input.downloadUrl}`
        : 'Your download link follows shortly.',
      '',
      input.accessLink
        ? `Your account is ready. Set your password (no password was emailed to you, and this link expires):\n${input.accessLink}`
        : '',
      '',
      'Reply to this email if anything is wrong.',
      '',
      'Docsy',
    ]
      .filter((l) => l !== '')
      .join('\n'),
  }
}

/** Access link on its own — for "set my password" and "email me a link". */
export function accessEmail(input: { accessLink: string; isNew: boolean }) {
  const body = `
    <tr><td style="padding:20px 28px 0;">
      <h1 style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:1.15;text-transform:uppercase;color:${BRAND.heading};">
        ${input.isNew ? 'Welcome to Docsy' : 'Sign in to Docsy'}
      </h1>
      <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.body};">
        ${
          input.isNew
            ? 'Use the button below to set your password. Your account keeps every file you buy, ready to re-download whenever you need it.'
            : 'Use the button below to sign in. You can set a new password once you are in.'
        }
      </p>
    </td></tr>
    <tr><td style="padding:22px 28px 0;">
      ${button(input.accessLink, input.isNew ? 'Set your password' : 'Sign in')}
      <p style="margin:12px 0 0;font-family:Georgia,serif;font-size:13px;color:${BRAND.muted};">
        This link can be used once and expires. If you did not ask for it, you can ignore this email —
        nothing changes until the link is used.
      </p>
    </td></tr>
    <tr><td style="padding:24px 28px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.tan};font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#555;">
        Questions? Just reply to this email.
      </p>
    </td></tr>`

  return {
    subject: input.isNew ? 'Set up your Docsy account' : 'Your Docsy sign-in link',
    html: shell({ preheader: 'Single-use link, expires shortly.', body }),
    text: [
      input.isNew ? 'Welcome to Docsy.' : 'Sign in to Docsy.',
      '',
      input.isNew ? 'Set your password:' : 'Sign in:',
      input.accessLink,
      '',
      'This link can be used once and expires. If you did not ask for it, ignore this email.',
      '',
      'Docsy',
    ].join('\n'),
  }
}

// =================================================================== campaign

export interface CampaignEmailInput {
  heading: string
  intro: string
  bullets?: string[]
  ctaLabel: string
  ctaUrl: string
  unsubscribeToken: string
  signoff?: string
}

/**
 * Campaign shell for the two audiences the admin segments on: buyers who have
 * purchased, and account holders who have not.
 *
 * Requires an unsubscribe token by type. A marketing email without a working
 * opt-out is the one mistake here with legal consequences, so it is impossible to
 * construct one from this function.
 */
export function campaignEmail(input: CampaignEmailInput) {
  const bullets = input.bullets?.length
    ? `<ul style="margin:14px 0 0;padding-left:18px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:${BRAND.body};">
         ${input.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
       </ul>`
    : ''

  const body = `
    <tr><td style="padding:20px 28px 0;">
      <h1 style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:1.2;text-transform:uppercase;color:${BRAND.heading};">${escapeHtml(input.heading)}</h1>
      <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${BRAND.body};">${escapeHtml(input.intro)}</p>
      ${bullets}
    </td></tr>
    <tr><td style="padding:22px 28px 0;">${button(input.ctaUrl, input.ctaLabel)}</td></tr>
    <tr><td style="padding:24px 28px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.tan};font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#555;">
        ${escapeHtml(input.signoff ?? 'Thanks for reading — reply any time, it reaches a person.')}
      </p>
    </td></tr>`

  return {
    subject: input.heading,
    html: shell({ preheader: input.intro.slice(0, 120), body, unsubscribeToken: input.unsubscribeToken }),
    text: [
      input.heading,
      '',
      input.intro,
      '',
      ...(input.bullets ?? []).map((b) => `- ${b}`),
      '',
      `${input.ctaLabel}: ${input.ctaUrl}`,
      '',
      `Unsubscribe: ${siteUrl()}/unsubscribe/${input.unsubscribeToken}`,
    ].join('\n'),
  }
}

/** Named starting points the admin can preview and adapt. */
export const CAMPAIGN_PRESETS = {
  'new-product': {
    audience: 'purchased' as const,
    label: 'New product announcement',
    description: 'For people who have already bought — they know the quality already.',
    heading: 'Something new in the shop',
    intro:
      'You have bought from Docsy before, so you know what to expect. Here is what just landed.',
    bullets: ['Ready to use the moment you download it', 'Yours to keep, with free updates'],
    ctaLabel: 'See what is new',
  },
  'first-purchase-nudge': {
    audience: 'no-purchase' as const,
    label: 'First-purchase nudge',
    description: 'For account holders who have never bought. Lead with the free product.',
    heading: 'Start with something free',
    intro:
      'You made a Docsy account but have not downloaded anything yet. Start with a free template and see if the approach suits you.',
    bullets: ['Free, no card needed', 'Set up in ten minutes', 'If it sticks, the paid ones go deeper'],
    ctaLabel: 'Browse free downloads',
  },
  'wishlist-reminder': {
    audience: 'no-purchase' as const,
    label: 'Wishlist reminder',
    description: 'For people who saved something and left it there.',
    heading: 'Still thinking about it?',
    intro: 'You saved something to your wishlist. It is still there, and still ready to download.',
    ctaLabel: 'Open your wishlist',
  },
} as const

export type CampaignPresetKey = keyof typeof CAMPAIGN_PRESETS
