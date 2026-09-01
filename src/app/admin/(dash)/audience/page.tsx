import Link from 'next/link'
import { MailCheck, ShoppingBag, UserX, Users } from 'lucide-react'
import { LocalTime } from '@/components/admin/local-time'
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { EMAIL_SETUP_HINT, isEmailConfigured } from '@/lib/email'
import { CAMPAIGN_PRESETS } from '@/lib/email-templates'
import { formatPrice } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface AudienceRow {
  id: string
  email: string
  full_name: string | null
  created_at: string
  purchases: number
  total_spent: number | null
  last_order_at: string | null
  has_purchased: boolean
}

/**
 * The two audiences campaigns are written for: people who have bought, and
 * account holders who have not.
 *
 * Read from the campaign_audience view rather than assembled here, so the
 * consent filter (opted in, not unsubscribed) cannot be forgotten at a call site
 * — including whatever eventually does the sending.
 */
export default async function AudiencePage({
  searchParams,
}: {
  searchParams: { segment?: string }
}) {
  await requireAdmin()
  const segment =
    searchParams.segment === 'purchased'
      ? 'purchased'
      : searchParams.segment === 'no-purchase'
        ? 'no-purchase'
        : 'all'

  const db = createAdminClient()
  const [{ data: audience }, { count: totalProfiles }, { count: unsubscribed }] = await Promise.all([
    db.from('campaign_audience').select('*').order('created_at', { ascending: false }).limit(500),
    db.from('buyer_profiles').select('id', { count: 'exact', head: true }),
    db
      .from('buyer_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('marketing_opt_in', false),
  ])

  const rows = (audience as AudienceRow[]) ?? []
  const purchasers = rows.filter((r) => r.has_purchased)
  const nonPurchasers = rows.filter((r) => !r.has_purchased)

  const shown =
    segment === 'purchased' ? purchasers : segment === 'no-purchase' ? nonPurchasers : rows

  const emailReady = await isEmailConfigured()

  return (
    <>
      <PageHeader
        title="Audience"
        subtitle="Who has an account, who has bought, and who to write to next."
      />

      {!emailReady && (
        <div className="mb-4 rounded-lg border border-brand-tan bg-brand-cream p-4">
          <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
            Email is not configured
          </p>
          <p className="mt-1 text-sm text-brand-body">
            {EMAIL_SETUP_HINT} Segments and templates below still work — nothing can be sent yet.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Accounts" value={totalProfiles ?? 0} hint="Total registered" />
        <StatCard
          label="Have bought"
          value={purchasers.length}
          hint="At least one delivered order"
          href="/admin/audience?segment=purchased"
        />
        <StatCard
          label="No purchase yet"
          value={nonPurchasers.length}
          hint="The nudge audience"
          href="/admin/audience?segment=no-purchase"
          accent={nonPurchasers.length > 0}
        />
        <StatCard label="Opted out" value={unsubscribed ?? 0} hint="Excluded from campaigns" />
      </div>

      {/* -------------------------------------------------------- templates */}
      <section className="mt-8">
        <h2 className="text-lg">Campaign templates</h2>
        <p className="mt-1 max-w-2xl text-sm text-brand-body">
          Starting points, each written for one of the two audiences. Every campaign email carries a
          working unsubscribe link — that is built into the template, not left to whoever sends it.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {Object.entries(CAMPAIGN_PRESETS).map(([key, preset]) => (
            <Card key={key} className="flex flex-col p-5">
              <span
                className={
                  preset.audience === 'purchased'
                    ? 'inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-wider text-green-800'
                    : 'inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-cream px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-heading'
                }
              >
                {preset.audience === 'purchased' ? (
                  <ShoppingBag className="h-3 w-3" aria-hidden />
                ) : (
                  <Users className="h-3 w-3" aria-hidden />
                )}
                {preset.audience === 'purchased' ? 'Has bought' : 'No purchase'}
              </span>

              <h3 className="mt-3 text-base leading-snug">{preset.label}</h3>
              <p className="mt-1 text-xs text-brand-body/80">{preset.description}</p>

              <div className="mt-3 rounded-md border border-border bg-brand-cream/30 p-3">
                <p className="font-heading text-xs font-bold uppercase tracking-wide text-brand-heading">
                  {preset.heading}
                </p>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-brand-body">
                  {preset.intro}
                </p>
              </div>

              <Link
                href={`/admin/emails/${key}`}
                className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-border px-3 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta"
              >
                <MailCheck className="h-3 w-3" aria-hidden />
                Preview email
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- segments */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: 'all', label: `Everyone (${rows.length})` },
            { key: 'purchased', label: `Has bought (${purchasers.length})` },
            { key: 'no-purchase', label: `No purchase (${nonPurchasers.length})` },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/admin/audience?segment=${t.key}`}
              className={
                segment === t.key
                  ? 'rounded-full border border-brand-cta bg-brand-cta px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide text-white'
                  : 'rounded-full border border-border bg-white px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide text-brand-body hover:border-brand-cta hover:text-brand-cta'
              }
            >
              {t.label}
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState
            title="Nobody in this segment yet"
            hint="Accounts are created automatically the first time somebody buys, so this fills up as you sell."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Purchases</Th>
                  <Th>Spent</Th>
                  <Th>Joined</Th>
                  <Th>Last order</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span className="block text-brand-heading">{r.full_name ?? '—'}</span>
                      <a
                        href={`mailto:${r.email}`}
                        className="text-xs text-brand-body/70 hover:text-brand-cta"
                      >
                        {r.email}
                      </a>
                    </Td>
                    <Td>
                      {r.purchases > 0 ? (
                        r.purchases
                      ) : (
                        <span className="inline-flex items-center gap-1 font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/60">
                          <UserX className="h-3 w-3" aria-hidden />
                          None
                        </span>
                      )}
                    </Td>
                    <Td>{r.total_spent ? formatPrice(Number(r.total_spent)) : '—'}</Td>
                    <Td className="whitespace-nowrap text-xs text-brand-body/70">
                      <LocalTime iso={r.created_at} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-brand-body/70">
                      {r.last_order_at ? <LocalTime iso={r.last_order_at} /> : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <p className="mt-3 text-xs text-brand-body/70">
              Showing up to 500. People who opted out are not listed — they are excluded by the
              audience view itself, so they cannot be mailed by accident.
            </p>
          </>
        )}
      </section>
    </>
  )
}
