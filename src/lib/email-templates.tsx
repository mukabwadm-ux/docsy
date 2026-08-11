import 'server-only'

/**
 * Email markup for Docsy.
 *
 * Plain string templates, not React. Email clients need table layout and inline
 * styles — Outlook strips <style> blocks and has no useful flexbox — and a receipt
 * is exactly the kind of message that gets read in Outlook.
 *
 * Every template goes through `shell()`, so the brand, the logo, the footer and
 * unsubscribe handling exist in one place. A campaign template that forgot its
 * unsubscribe link would be a legal problem, not a formatting one.
 */

/** The same values as tailwind.config.ts. Changing one means changing both. */
const BRAND = {
  cta: '#EB2437',
  accent: '#E4340C',
  tan: '#F6E3BB',
  cream: '#FFF6DB',
  heading: '#151515',
  body: '#373737',
  /** Derived from body rather than an invented grey, so the palette stays closed. */
  muted: '#6f6b66',
  border: '#F6E3BB',
}

/**
 * The site's pairing: Oswald for headings and CTAs, Lora for body copy.
 *
 * Named first, with the fallbacks the site itself declares. Apple Mail, iOS Mail
 * and Thunderbird load the web fonts and render exactly like the storefront;
 * Outlook and Gmail ignore them and land on the next entry, which is why the
 * fallbacks are chosen to hold the same shape — Arial Narrow is condensed like
 * Oswald, Georgia is a serif like Lora. The result degrades in weight, not in
 * character.
 */
const FONT = {
  heading: "'Oswald','Arial Narrow',Arial,sans-serif",
  body: "'Lora',Georgia,'Times New Roman',serif",
}

/**
 * Hidden from Outlook with a downlevel-revealed conditional comment.
 *
 * Outlook's Word rendering engine handles @font-face badly enough to break
 * layout, and it would fall back regardless. Skipping it there costs nothing and
 * removes the failure mode.
 */
const WEB_FONTS = `<!--[if !mso]><!-->
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Lora:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <!--<![endif]-->`

/** Type scale mirroring the site: tight tracking on headings, wide on labels. */
const TYPE = {
  h1: `font-family:${FONT.heading};font-size:27px;line-height:1.15;font-weight:700;text-transform:uppercase;letter-spacing:-0.3px;color:${BRAND.heading};margin:0;`,
  h2: `font-family:${FONT.heading};font-size:19px;line-height:1.2;font-weight:700;text-transform:uppercase;letter-spacing:-0.2px;color:${BRAND.heading};margin:0;`,
  eyebrow: `font-family:${FONT.heading};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:${BRAND.muted};margin:0;`,
  label: `font-family:${FONT.heading};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${BRAND.heading};margin:0;`,
  body: `font-family:${FONT.body};font-size:16px;line-height:1.65;color:${BRAND.body};margin:0;`,
  small: `font-family:${FONT.body};font-size:13px;line-height:1.55;color:${BRAND.muted};margin:0;`,
  price: `font-family:${FONT.heading};font-size:22px;font-weight:700;color:${BRAND.heading};margin:0;`,
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

/** "Hi Alex," or "Hi," — returned raw and escaped, so the text part stays clean. */
function greet(name: string | null | undefined) {
  const first = name?.trim().split(' ')[0]
  const raw = first ? `Hi ${first},` : 'Hi,'
  return { raw, html: escapeHtml(raw) }
}

/**
 * The logo: a rounded red tile with the wordmark beside it, drawn in HTML.
 *
 * Not an <img>. Most clients block remote images by default, so an image logo
 * means the top of the email is an empty box for a large share of recipients.
 * This renders everywhere with nothing to download, and the tile uses the same
 * #EB2437 as the site's icon.
 */
function logo() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="34" height="34" align="center" valign="middle"
          style="background:${BRAND.cta};border-radius:8px;color:#ffffff;font-family:${FONT.heading};font-size:18px;font-weight:700;line-height:34px;">D</td>
      <td style="padding-left:10px;font-family:${FONT.heading};font-size:23px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND.heading};">Docsy</td>
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
  const footerNote = unsubscribeToken
    ? `You are receiving this because you have a Docsy account.
       <a href="${escapeAttr(siteUrl())}/unsubscribe/${escapeAttr(unsubscribeToken)}" style="color:${BRAND.muted};">Unsubscribe</a>.`
    : 'You are receiving this because you placed an order with Docsy.'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <!-- Opt out of forced dark-mode inversion: the palette is light by design and
         auto-inverting turns the cream into a muddy brown. -->
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    ${WEB_FONTS}
    <style>
      /* Only clients that honour <style> get these; nothing here is load-bearing. */
      a { color: ${BRAND.cta}; }
      @media (max-width: 600px) {
        .wrap { padding: 20px 12px !important; }
        .pad { padding-left: 20px !important; padding-right: 20px !important; }
        .h1 { font-size: 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.cream};-webkit-font-smoothing:antialiased;">
    <!-- Preheader: the grey line clients show beside the subject. Left unset they
         scrape the first words of the body, which is usually just "Hi,". -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="wrap" style="background:${BRAND.cream};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:10px;">
            <tr><td class="pad" style="padding:28px 28px 0;">${logo()}</td></tr>
            ${body}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr><td style="padding:14px 8px 0;">
              <p style="${TYPE.small}font-size:12px;">${footerNote}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Red CTA, matching the site's button: Oswald, uppercase, 6px radius. */
function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="background:${BRAND.cta};border-radius:6px;">
        <a href="${escapeAttr(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT.heading};font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function receiptTable(lines: ReceiptLine[], total: number, currency: string, reference: string) {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:11px 0;border-bottom:1px solid ${BRAND.border};${TYPE.body}font-size:15px;">
          ${escapeHtml(l.title)}
          ${l.fileType ? `<br /><span style="${TYPE.small}font-size:12px;">${escapeHtml(l.fileType)}</span>` : ''}
        </td>
        <td align="right" style="padding:11px 0;border-bottom:1px solid ${BRAND.border};${TYPE.label}white-space:nowrap;font-size:16px;">
          ${escapeHtml(money(l.amount, l.currency))}
        </td>
      </tr>`
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
    <tr>
      <td colspan="2" style="padding-bottom:6px;${TYPE.eyebrow}">Receipt · ${escapeHtml(reference)}</td>
    </tr>
    ${rows}
    <tr>
      <td style="padding:13px 0;${TYPE.label}">Total</td>
      <td align="right" style="padding:13px 0;${TYPE.price}white-space:nowrap;">${escapeHtml(money(total, currency))}</td>
    </tr>
  </table>`
}

/** Reusable divider + closing line, so every template ends the same way. */
function signoff(text: string) {
  return `<tr><td class="pad" style="padding:24px 28px 28px;">
    <p style="${TYPE.body}font-size:14px;padding-top:18px;border-top:1px solid ${BRAND.border};">${text}</p>
  </td></tr>`
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
  /** Present only on a first order, when the account was just created. */
  accessLink?: string | null
}

/**
 * Receipt, download link and — on a first order — the link that sets up the
 * account. One message rather than three: somebody who has just paid should not
 * have to reconcile several emails arriving in an unpredictable order.
 */
export function receiptEmail(input: ReceiptEmailInput) {
  const g = greet(input.buyerName)

  const downloadBlock = input.downloadUrl
    ? `<tr><td class="pad" style="padding:22px 28px 0;">
         ${button(input.downloadUrl, 'Download your files')}
         <p style="${TYPE.small}margin-top:12px;">
           This link works for ${escapeHtml(input.expiresIn)}. Save the file somewhere safe once you have it.
         </p>
       </td></tr>`
    : `<tr><td class="pad" style="padding:22px 28px 0;">
         <p style="${TYPE.body}">Your download link follows shortly, in a separate email.</p>
       </td></tr>`

  const accessBlock = input.accessLink
    ? `<tr><td class="pad" style="padding:24px 28px 0;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream};border:1px solid ${BRAND.tan};border-radius:8px;">
           <tr><td style="padding:18px;">
             <p style="${TYPE.label}font-size:15px;">Your Docsy account is ready</p>
             <p style="${TYPE.body}font-size:14px;margin-top:8px;">
               We created an account so you can re-download anything you buy, any time. Set your
               password and it is yours — no password was emailed to you, and this link expires.
             </p>
             <div style="margin-top:14px;">${button(input.accessLink, 'Set your password')}</div>
           </td></tr>
         </table>
       </td></tr>`
    : ''

  const body = `
    <tr><td class="pad" style="padding:20px 28px 0;">
      <h1 class="h1" style="${TYPE.h1}">Thanks for your order</h1>
      <p style="${TYPE.body}margin-top:14px;">${g.html}</p>
      <p style="${TYPE.body}margin-top:10px;">Your order is confirmed. Here is your receipt.</p>
    </td></tr>
    <tr><td class="pad" style="padding:16px 28px 0;">${receiptTable(input.lines, input.total, input.currency, input.reference)}</td></tr>
    ${downloadBlock}
    ${accessBlock}
    ${signoff('Anything wrong with the file, or the link expired? Reply to this email — it reaches a person.')}`

  return {
    subject: `Your Docsy receipt${input.lines[0] ? ` — ${input.lines[0].title}` : ''}`,
    html: shell({
      preheader: `Receipt ${input.reference} · ${money(input.total, input.currency)}`,
      body,
    }),
    text: [
      g.raw,
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
      ...(input.accessLink
        ? [
            '',
            `Your account is ready. Set your password (no password was emailed to you, and this link expires):\n${input.accessLink}`,
          ]
        : []),
      '',
      'Reply to this email if anything is wrong.',
      '',
      'Docsy',
    ].join('\n'),
  }
}

export interface DeliveryEmailInput {
  buyerName: string | null
  productTitle: string
  downloadUrl: string
  expiresIn: string
  fileTypeLabel?: string | null
}

/**
 * The file itself, sent when an order is fulfilled.
 *
 * Uses the same shell as everything else. It previously had its own hand-rolled
 * markup with a plain-text wordmark, so the one email every buyer definitely
 * opens was the one that looked least like the shop.
 */
export function deliveryEmail(input: DeliveryEmailInput) {
  const g = greet(input.buyerName)

  const body = `
    <tr><td class="pad" style="padding:20px 28px 0;">
      <h1 class="h1" style="${TYPE.h1}">Your download is ready</h1>
      <p style="${TYPE.body}margin-top:14px;">${g.html}</p>
      <p style="${TYPE.body}margin-top:10px;">
        Thanks for your order. Here is your copy of <strong style="color:${BRAND.heading};">${escapeHtml(input.productTitle)}</strong>${
          input.fileTypeLabel ? `, as ${escapeHtml(input.fileTypeLabel)}` : ''
        }.
      </p>
    </td></tr>
    <tr><td class="pad" style="padding:22px 28px 0;">
      ${button(input.downloadUrl, 'Download it now')}
      <p style="${TYPE.small}margin-top:12px;">
        This link works for ${escapeHtml(input.expiresIn)}. Save the file somewhere safe once you have it.
      </p>
    </td></tr>
    ${signoff('If anything is wrong with the file, or the link has expired, just reply to this email — it reaches a person.')}`

  return {
    subject: `Your download: ${input.productTitle}`,
    html: shell({ preheader: `${input.productTitle} — ready to download`, body }),
    text: [
      g.raw,
      '',
      `Thanks for your order. Here is your download for ${input.productTitle}:`,
      '',
      input.downloadUrl,
      '',
      `The link works for ${input.expiresIn}${input.fileTypeLabel ? ` and gives you the ${input.fileTypeLabel}` : ''}. Save the file somewhere safe once you have it.`,
      '',
      'If anything is wrong with it, just reply to this email and we will sort it out.',
      '',
      'Docsy',
    ].join('\n'),
  }
}

/** Access link on its own — "set my password" and "email me a link". */
export function accessEmail(input: { accessLink: string; isNew: boolean }) {
  const body = `
    <tr><td class="pad" style="padding:20px 28px 0;">
      <h1 class="h1" style="${TYPE.h1}">${input.isNew ? 'Welcome to Docsy' : 'Sign in to Docsy'}</h1>
      <p style="${TYPE.body}margin-top:14px;">
        ${
          input.isNew
            ? 'Use the button below to set your password. Your account keeps every file you buy, ready to re-download whenever you need it.'
            : 'Use the button below to sign in. You can set a new password once you are in.'
        }
      </p>
    </td></tr>
    <tr><td class="pad" style="padding:22px 28px 0;">
      ${button(input.accessLink, input.isNew ? 'Set your password' : 'Sign in')}
      <p style="${TYPE.small}margin-top:12px;">
        This link can be used once and expires. If you did not ask for it you can ignore this email —
        nothing changes until the link is used.
      </p>
    </td></tr>
    ${signoff('Questions? Just reply to this email.')}`

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
 * Campaign shell for the two audiences the admin segments on.
 *
 * Requires an unsubscribe token by type. A marketing email without a working
 * opt-out is the one mistake here with legal consequences, so it is impossible to
 * construct one from this function.
 */
export function campaignEmail(input: CampaignEmailInput) {
  const bullets = input.bullets?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
         ${input.bullets
           .map(
             (b) => `<tr>
               <td width="18" valign="top" style="padding:4px 0 0;">
                 <div style="width:6px;height:6px;border-radius:3px;background:${BRAND.cta};margin-top:7px;"></div>
               </td>
               <td style="${TYPE.body}font-size:15px;padding:3px 0;">${escapeHtml(b)}</td>
             </tr>`
           )
           .join('')}
       </table>`
    : ''

  const body = `
    <tr><td class="pad" style="padding:20px 28px 0;">
      <h1 class="h1" style="${TYPE.h1}">${escapeHtml(input.heading)}</h1>
      <p style="${TYPE.body}margin-top:14px;">${escapeHtml(input.intro)}</p>
      ${bullets}
    </td></tr>
    <tr><td class="pad" style="padding:22px 28px 0;">${button(input.ctaUrl, input.ctaLabel)}</td></tr>
    ${signoff(escapeHtml(input.signoff ?? 'Thanks for reading — reply any time, it reaches a person.'))}`

  return {
    subject: input.heading,
    html: shell({
      preheader: input.intro.slice(0, 120),
      body,
      unsubscribeToken: input.unsubscribeToken,
    }),
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
