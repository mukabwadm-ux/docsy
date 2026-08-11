import Link from 'next/link'
import { Mail, Megaphone, Receipt } from 'lucide-react'
import { Card, PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { EMAIL_SETUP_HINT, isEmailConfigured } from '@/lib/email'
import { getEmailSamples } from '@/lib/email-samples'

export const dynamic = 'force-dynamic'

/**
 * Every email Docsy can send, in one place.
 *
 * Worth having as a page rather than a folder of files: these are the only part of
 * the shop the owner cannot see by browsing it, and an email that looks wrong is
 * discovered by a customer otherwise.
 */
export default async function EmailsPage() {
  await requireAdmin()
  const samples = getEmailSamples()
  const transactional = samples.filter((s) => s.kind === 'transactional')
  const campaigns = samples.filter((s) => s.kind === 'campaign')

  return (
    <>
      <PageHeader
        title="Emails"
        subtitle="Every message the shop sends, with the brand and typography from the site."
      />

      {!isEmailConfigured() && (
        <div className="mb-6 rounded-lg border border-brand-tan bg-brand-cream p-4">
          <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
            Nothing can send yet
          </p>
          <p className="mt-1 text-sm text-brand-body">{EMAIL_SETUP_HINT}</p>
        </div>
      )}

      <Section
        title="Transactional"
        icon={Receipt}
        note="Part of the purchase, so these always send — consent settings do not apply."
        samples={transactional}
      />

      <Section
        title="Campaigns"
        icon={Megaphone}
        note="Marketing. Only sent to people who have opted in, and every one carries an unsubscribe link."
        samples={campaigns}
      />
    </>
  )
}

function Section({
  title,
  icon: Icon,
  note,
  samples,
}: {
  title: string
  icon: typeof Mail
  note: string
  samples: ReturnType<typeof getEmailSamples>
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="flex items-center gap-2 text-lg">
        <Icon className="h-4 w-4 text-brand-cta" aria-hidden />
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-brand-body">{note}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {samples.map((s) => (
          <Card key={s.key} className="flex flex-col p-5">
            <h3 className="text-base leading-snug">{s.label}</h3>
            <dl className="mt-2 space-y-1 text-xs text-brand-body/80">
              <div>
                <dt className="inline font-heading font-bold uppercase tracking-wider">To: </dt>
                <dd className="inline">{s.audience}</dd>
              </div>
              <div>
                <dt className="inline font-heading font-bold uppercase tracking-wider">When: </dt>
                <dd className="inline">{s.when}</dd>
              </div>
            </dl>

            <p className="mt-3 rounded-md border border-border bg-brand-cream/30 p-2.5 text-xs text-brand-heading">
              {s.subject}
            </p>

            <Link
              href={`/admin/emails/${s.key}`}
              className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-border px-3 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta"
            >
              <Mail className="h-3 w-3" aria-hidden />
              Preview
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}
