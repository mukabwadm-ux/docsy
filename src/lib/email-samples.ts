import 'server-only'

import {
  accessEmail,
  campaignEmail,
  deliveryEmail,
  receiptEmail,
  CAMPAIGN_PRESETS,
  type CampaignPresetKey,
} from './email-templates'

/**
 * Every email Docsy can send, with representative sample data.
 *
 * One list, used by the admin preview page. Adding a template without adding it
 * here means it ships unreviewed, which is how the delivery email ended up as the
 * only message that did not look like the shop.
 */
export type EmailKind = 'transactional' | 'campaign'

export interface EmailSample {
  key: string
  label: string
  kind: EmailKind
  /** Who receives it, in plain terms. */
  audience: string
  when: string
  subject: string
  html: string
  text: string
}

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const SAMPLE_LINK = () => `${SITE()}/account/callback?token_hash=sample-token`
const SAMPLE_DOWNLOAD = () => `${SITE()}/example-signed-download`

export function getEmailSamples(): EmailSample[] {
  const receiptFirst = receiptEmail({
    buyerName: 'Alex Morgan',
    lines: [
      {
        title: 'The 90-Day Content Calendar',
        fileType: 'Excel workbook',
        amount: 29,
        currency: 'USD',
      },
    ],
    total: 29,
    currency: 'USD',
    reference: 'DCS-4F9A2B71',
    downloadUrl: null,
    expiresIn: '7 days',
    accessLink: SAMPLE_LINK(),
  })

  const receiptReturning = receiptEmail({
    buyerName: 'Alex Morgan',
    lines: [
      { title: 'Pitch Deck Kit — 40 Editable Slides', fileType: 'Figma file', amount: 49, currency: 'USD' },
    ],
    total: 49,
    currency: 'USD',
    reference: 'DCS-91C3E0A4',
    downloadUrl: SAMPLE_DOWNLOAD(),
    expiresIn: '7 days',
    accessLink: null,
  })

  const delivery = deliveryEmail({
    buyerName: 'Alex Morgan',
    productTitle: 'The 90-Day Content Calendar',
    downloadUrl: SAMPLE_DOWNLOAD(),
    expiresIn: '7 days',
    fileTypeLabel: 'Excel workbook',
  })

  const welcome = accessEmail({ accessLink: SAMPLE_LINK(), isNew: true })
  const signIn = accessEmail({ accessLink: SAMPLE_LINK(), isNew: false })

  const transactional: EmailSample[] = [
    {
      key: 'receipt-first',
      label: 'Receipt — first order',
      kind: 'transactional',
      audience: 'A buyer with no account yet',
      when: 'Immediately after checkout',
      ...receiptFirst,
    },
    {
      key: 'receipt-returning',
      label: 'Receipt — returning buyer',
      kind: 'transactional',
      audience: 'A buyer who already has an account',
      when: 'Immediately after checkout',
      ...receiptReturning,
    },
    {
      key: 'delivery',
      label: 'File delivery',
      kind: 'transactional',
      audience: 'A buyer whose order was fulfilled',
      when: 'When you send the file from the orders queue',
      ...delivery,
    },
    {
      key: 'welcome',
      label: 'Set your password',
      kind: 'transactional',
      audience: 'A new account holder',
      when: 'On request, or with a first receipt',
      ...welcome,
    },
    {
      key: 'sign-in',
      label: 'Sign-in link',
      kind: 'transactional',
      audience: 'A returning buyer who asked for a link',
      when: 'On request, and as the forgot-password path',
      ...signIn,
    },
  ]

  const campaigns: EmailSample[] = (
    Object.keys(CAMPAIGN_PRESETS) as CampaignPresetKey[]
  ).map((key) => {
    const preset = CAMPAIGN_PRESETS[key]
    const message = campaignEmail({
      heading: preset.heading,
      intro: preset.intro,
      bullets: 'bullets' in preset ? [...(preset.bullets ?? [])] : undefined,
      ctaLabel: preset.ctaLabel,
      ctaUrl: `${SITE()}/products`,
      // A placeholder; the real token comes from the recipient's profile at send
      // time, which is what makes each unsubscribe link personal.
      unsubscribeToken: '0'.repeat(32),
    })
    return {
      key,
      label: preset.label,
      kind: 'campaign' as const,
      audience:
        preset.audience === 'purchased'
          ? 'People who have bought at least once'
          : 'Account holders who have never bought',
      when: 'When you run a campaign',
      ...message,
    }
  })

  return [...transactional, ...campaigns]
}

export function getEmailSample(key: string): EmailSample | undefined {
  return getEmailSamples().find((s) => s.key === key)
}
