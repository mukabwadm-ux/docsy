/**
 * Every configuration value Docsy understands.
 *
 * One list, used to build the admin form, to decide what is a secret, and to know
 * which environment variable each setting shadows. Adding a row here is all it
 * takes to expose a new setting — and nothing outside this list can be written,
 * so a crafted form post cannot invent a key.
 */

export type ConfigGroupId = 'payments' | 'analytics' | 'email' | 'store'

export interface ConfigField {
  /** Storage key, also the form field name. */
  key: string
  label: string
  /** Shown under the input. Say what it is for and where to find it. */
  hint?: string
  /**
   * Secrets are encrypted at rest and never sent back to the browser — the form
   * shows a mask and offers to replace them.
   */
  secret?: boolean
  /**
   * The environment variable this shadows. When that variable is set it wins, and
   * the field is shown as locked rather than pretending to be editable.
   */
  env?: string
  placeholder?: string
  type?: 'text' | 'url' | 'email' | 'number'
}

export interface ConfigGroup {
  id: ConfigGroupId
  label: string
  description: string
  /** Rendered when the group is not usable yet. */
  fields: ConfigField[]
}

export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: 'payments',
    label: 'Paystack',
    description:
      'Takes M-Pesa, cards and bank transfer, and settles KES to a Kenyan account. Use the test keys until you are ready to charge real money — they behave identically.',
    fields: [
      {
        key: 'paystack.secret_key',
        label: 'Secret key',
        hint: 'Paystack dashboard → Settings → API Keys. Starts sk_test_ or sk_live_. Never shown again once saved.',
        secret: true,
        env: 'PAYSTACK_SECRET_KEY',
        placeholder: 'sk_test_…',
      },
      {
        key: 'paystack.public_key',
        label: 'Public key',
        hint: 'Safe to expose; it identifies your account to the payment page.',
        env: 'PAYSTACK_PUBLIC_KEY',
        placeholder: 'pk_test_…',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics and pixels',
    description:
      'Loaded on the storefront only, never in the admin panel. All of these are public identifiers by design — they ship to the browser.',
    fields: [
      {
        key: 'analytics.ga4_id',
        label: 'Google Analytics 4 measurement ID',
        hint: 'Google Analytics → Admin → Data streams. Looks like G-XXXXXXXXXX.',
        placeholder: 'G-XXXXXXXXXX',
      },
      {
        key: 'analytics.gtm_id',
        label: 'Google Tag Manager container ID',
        hint: 'Use this instead of GA4 if you manage tags through GTM. Looks like GTM-XXXXXXX.',
        placeholder: 'GTM-XXXXXXX',
      },
      {
        key: 'analytics.meta_pixel_id',
        label: 'Meta (Facebook) Pixel ID',
        hint: 'Events Manager → Data sources. Needed for Facebook and Instagram ad tracking.',
        placeholder: '1234567890123456',
      },
      {
        key: 'analytics.tiktok_pixel_id',
        label: 'TikTok Pixel ID',
        hint: 'TikTok Ads Manager → Assets → Events.',
        placeholder: 'CXXXXXXXXXXXXXXXXXXX',
      },
    ],
  },
  {
    id: 'email',
    label: 'Email delivery',
    description:
      'Receipts, download links and campaigns. SMTP is used when a host is set; otherwise Resend. A sending address is required either way.',
    fields: [
      {
        key: 'email.from',
        label: 'From address',
        hint: 'Use an address on a domain you control, and add SPF and DKIM records for it — that, not the transport, is what decides whether mail lands quickly.',
        env: 'EMAIL_FROM',
        placeholder: 'Docsy <hello@docsy.imprinnt.co>',
      },
      {
        key: 'email.copy_to',
        label: 'Send me a copy of transaction emails',
        hint: 'Every receipt and delivery email is blind-copied here, so you keep a record of each sale. Campaigns are never copied — a 200-person send would put 200 copies in your inbox. Leave blank for no copies.',
        env: 'EMAIL_COPY_TO',
        type: 'email',
        placeholder: 'docsy@imprinnt.co',
      },
      {
        key: 'email.smtp_host',
        label: 'SMTP host',
        hint: 'From your hosting control panel, under mail client settings. Leave blank to use Resend instead.',
        env: 'SMTP_HOST',
        placeholder: 'mail.imprinnt.co',
      },
      {
        key: 'email.smtp_port',
        label: 'SMTP port',
        hint: '587 for STARTTLS, 465 for implicit TLS. 587 is the usual answer.',
        env: 'SMTP_PORT',
        placeholder: '587',
        type: 'number',
      },
      {
        key: 'email.smtp_user',
        label: 'SMTP username',
        hint: 'Usually the full email address.',
        env: 'SMTP_USER',
        placeholder: 'hello@imprinnt.co',
      },
      {
        key: 'email.smtp_pass',
        label: 'SMTP password',
        secret: true,
        env: 'SMTP_PASS',
        hint: 'The mailbox password. Stored encrypted.',
      },
      {
        key: 'email.resend_api_key',
        label: 'Resend API key',
        hint: 'Only used when no SMTP host is set. Starts re_.',
        secret: true,
        env: 'RESEND_API_KEY',
        placeholder: 're_…',
      },
    ],
  },
  {
    id: 'store',
    label: 'Store details',
    description: 'Shown to buyers on the storefront and in emails.',
    fields: [
      {
        key: 'store.support_email',
        label: 'Support email',
        hint: 'Where buyers are told to write. Defaults to the From address.',
        type: 'email',
        placeholder: 'help@imprinnt.co',
      },
      {
        key: 'store.whatsapp',
        label: 'WhatsApp number',
        hint: 'With country code. Shown as a contact option where relevant.',
        placeholder: '+254700000000',
      },
      {
        key: 'store.site_url',
        label: 'Public site URL',
        hint: 'Used in emails and canonical tags. Set in the environment at build time, so this is read-only here.',
        env: 'NEXT_PUBLIC_SITE_URL',
        type: 'url',
        placeholder: 'https://docsy.imprinnt.co',
      },
    ],
  },
]

/** Flat lookup, so a form post can be validated against known keys only. */
export const CONFIG_FIELDS: Record<string, ConfigField> = Object.fromEntries(
  CONFIG_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f]))
)

export function isKnownConfigKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONFIG_FIELDS, key)
}

export function isSecretKey(key: string): boolean {
  return CONFIG_FIELDS[key]?.secret === true
}
