import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CampaignForm } from '@/components/admin/campaign-form'
import { CampaignSender } from '@/components/admin/campaign-sender'
import { LocalTime } from '@/components/admin/local-time'
import { Card, PageHeader, StatusPill, Table, Td, Th } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { AUDIENCE_LABEL, getCampaign, getProgress, getRecipients } from '@/lib/campaigns'
import { campaignEmail } from '@/lib/email-templates'
import { isMailConfigured, mailSetupHint } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin()

  const campaign = await getCampaign(params.id)
  if (!campaign) notFound()

  const [progress, recipients] = await Promise.all([
    getProgress(campaign.id),
    getRecipients(campaign.id),
  ])

  // Rendered with a placeholder token; each real send substitutes the
  // recipient's own, which is what makes their unsubscribe link theirs.
  const preview = campaignEmail({
    heading: campaign.heading,
    intro: campaign.intro,
    bullets: campaign.bullets,
    ctaLabel: campaign.cta_label,
    ctaUrl: campaign.cta_url,
    unsubscribeToken: '0'.repeat(32),
  })

  const locked = campaign.status !== 'draft'

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={`${AUDIENCE_LABEL[campaign.audience]} · created ${new Date(campaign.created_at).toLocaleDateString('en-US')}`}
        action={
          <Link
            href="/admin/campaigns"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading hover:border-brand-cta hover:text-brand-cta"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All campaigns
          </Link>
        }
      />

      <div className="mb-6">
        <CampaignSender
          campaignId={campaign.id}
          status={campaign.status}
          progress={progress}
          mailReady={isMailConfigured()}
          mailHint={mailSetupHint()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg">Preview</h2>
          <p className="mt-1 text-sm text-brand-body">
            Exactly what recipients receive. Subject: <strong>{campaign.subject}</strong>
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <iframe
              title="Campaign preview"
              srcDoc={preview.html}
              className="h-[640px] w-full bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg">Recipients</h2>
          <p className="mt-1 text-sm text-brand-body">
            {progress.queued === 0
              ? 'Nobody is queued yet — the audience is resolved when the send starts.'
              : `${progress.queued} queued in total.`}
          </p>

          <div className="mt-3">
            {recipients.length === 0 ? (
              <Card className="p-5">
                <p className="text-sm text-brand-body">
                  Once you start the send, every recipient is recorded here with what happened to
                  them.
                </p>
              </Card>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id}>
                      <Td className="text-brand-heading">{r.email}</Td>
                      <Td>
                        <StatusPill status={r.status === 'sent' ? 'delivered' : r.status} />
                        {r.error && (
                          <span className="mt-1 block max-w-xs text-[11px] text-red-600">
                            {r.error}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-brand-body/70">
                        {r.sent_at ? <LocalTime iso={r.sent_at} /> : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg">Content</h2>
        <div className="mt-3">
          <CampaignForm
            defaults={{
              id: campaign.id,
              name: campaign.name,
              subject: campaign.subject,
              heading: campaign.heading,
              intro: campaign.intro,
              bullets: campaign.bullets,
              cta_label: campaign.cta_label,
              cta_url: campaign.cta_url,
              audience: campaign.audience,
            }}
            locked={locked}
          />
        </div>
      </section>
    </>
  )
}
