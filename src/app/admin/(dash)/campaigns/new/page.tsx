import { PageHeader } from '@/components/admin/ui'
import { CampaignForm } from '@/components/admin/campaign-form'
import { requireAdmin } from '@/lib/auth'
import { CAMPAIGN_PRESETS } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: { preset?: string }
}) {
  await requireAdmin()

  const preset = searchParams.preset
    ? CAMPAIGN_PRESETS[searchParams.preset as keyof typeof CAMPAIGN_PRESETS]
    : undefined

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return (
    <>
      <PageHeader
        title="New campaign"
        subtitle="Nothing sends until you start it, and you can check the audience size first."
      />
      <CampaignForm
        defaults={
          preset
            ? {
                name: preset.label,
                subject: preset.heading,
                heading: preset.heading,
                intro: preset.intro,
                bullets: 'bullets' in preset ? [...(preset.bullets ?? [])] : [],
                cta_label: preset.ctaLabel,
                cta_url: `${siteUrl}/products`,
                audience: preset.audience === 'purchased' ? 'purchased' : 'no-purchase',
              }
            : { cta_url: `${siteUrl}/products` }
        }
        presets={Object.entries(CAMPAIGN_PRESETS).map(([key, p]) => ({ key, label: p.label }))}
      />
    </>
  )
}
