import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { LocalTime } from '@/components/admin/local-time'
import { EmptyState, PageHeader, StatusPill, Table, Td, Th } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/auth'
import { AUDIENCE_LABEL, listCampaigns } from '@/lib/campaigns'
import { isMailConfigured, mailSetupHint } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  await requireAdmin()
  const campaigns = await listCampaigns()

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Write once, send to a segment. Every campaign carries an unsubscribe link."
        action={
          <Button asChild variant="cta" size="md">
            <Link href="/admin/campaigns/new">
              <Plus className="h-4 w-4" aria-hidden />
              New campaign
            </Link>
          </Button>
        }
      />

      {!isMailConfigured() && (
        <div className="mb-4 rounded-lg border border-brand-tan bg-brand-cream p-4">
          <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
            Sending is unavailable
          </p>
          <p className="mt-1 text-sm text-brand-body">
            {mailSetupHint()} You can still write campaigns and check audience sizes.
          </p>
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          hint="A campaign is an email to a segment — new products for people who have bought, or a nudge for accounts that never did."
          action={
            <Button asChild variant="cta" size="md">
              <Link href="/admin/campaigns/new">Write the first one</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Campaign</Th>
              <Th>Audience</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="font-medium text-brand-heading hover:text-brand-cta"
                  >
                    {c.name}
                  </Link>
                  <span className="mt-0.5 block max-w-sm truncate text-xs text-brand-body/70">
                    {c.subject}
                  </span>
                </Td>
                <Td className="text-xs text-brand-body">{AUDIENCE_LABEL[c.audience]}</Td>
                <Td>
                  <StatusPill status={c.status === 'sending' ? 'pending' : c.status} />
                </Td>
                <Td className="whitespace-nowrap text-xs">
                  {c.queued === 0 ? (
                    <span className="text-brand-body/60">not queued</span>
                  ) : (
                    <>
                      <span className="text-brand-heading">{c.sent} sent</span>
                      {c.failed > 0 && <span className="text-red-600"> · {c.failed} failed</span>}
                      {c.pending > 0 && (
                        <span className="text-brand-body/70"> · {c.pending} pending</span>
                      )}
                    </>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs text-brand-body/70">
                  <LocalTime iso={c.created_at} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-brand-body/70">
        <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Recipients are resolved when a send starts, not when the campaign is written, and anyone who
        opted out is excluded by the audience view itself.
      </p>
    </>
  )
}
