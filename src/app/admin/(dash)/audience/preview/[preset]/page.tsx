import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { CAMPAIGN_PRESETS, campaignEmail, type CampaignPresetKey } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

/**
 * Renders a campaign template exactly as it will arrive.
 *
 * The HTML goes into an iframe with a srcDoc rather than into the page. Email
 * markup is a full document with its own body styles and table layout; injected
 * inline it would inherit the admin panel's CSS and fight with it, so the preview
 * would look nothing like the email.
 */
export default async function PreviewPage({ params }: { params: { preset: string } }) {
  await requireAdmin()

  const key = params.preset as CampaignPresetKey
  const preset = CAMPAIGN_PRESETS[key]
  if (!preset) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const message = campaignEmail({
    heading: preset.heading,
    intro: preset.intro,
    bullets: 'bullets' in preset ? [...(preset.bullets ?? [])] : undefined,
    ctaLabel: preset.ctaLabel,
    ctaUrl: `${siteUrl}/products`,
    // Sample token: the real one comes from the recipient's profile at send time.
    unsubscribeToken: '0'.repeat(32),
  })

  return (
    <>
      <PageHeader
        title={preset.label}
        subtitle={`Audience: ${preset.audience === 'purchased' ? 'people who have bought' : 'accounts with no purchase'}`}
        action={
          <Link
            href="/admin/audience"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading hover:border-brand-cta hover:text-brand-cta"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to audience
          </Link>
        }
      />

      <div className="rounded-lg border border-border bg-white p-4 shadow-card">
        <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
          Subject
        </p>
        <p className="mt-1 text-brand-heading">{message.subject}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <iframe
          title={`${preset.label} preview`}
          srcDoc={message.html}
          className="h-[760px] w-full bg-white"
          sandbox=""
        />
      </div>

      <details className="mt-4 rounded-lg border border-border bg-white p-4">
        <summary className="cursor-pointer font-heading text-xs font-bold uppercase tracking-wide text-brand-heading">
          Plain-text version
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-body text-sm text-brand-body">{message.text}</pre>
      </details>
    </>
  )
}
