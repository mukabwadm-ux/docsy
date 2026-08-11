import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { LocalTime } from '@/components/admin/local-time'
import { Card, PageHeader, StatCard, StatusPill, Table, Td, Th } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/auth'
import { formatPrice, formatRelative } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'
import { one } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAdmin()
  const db = createAdminClient()

  const [
    products,
    active,
    pendingOrders,
    pendingReviews,
    recentOrders,
    collectedManual,
    pendingManual,
    collectedGateway,
  ] = await Promise.all([
    db.from('products').select('id', { count: 'exact', head: true }),
    db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('manual_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db
      .from('manual_orders')
      .select('id, buyer_email, buyer_name, amount, currency, status, created_at, products ( title )')
      .order('created_at', { ascending: false })
      .limit(8),
    /**
     * Money in. Only a completed purchase counts.
     *
     * For a manual order that means `delivered` — the point at which the file
     * has actually been sent. A pending row is an intention, and counting it
     * would inflate the one number on this page that decisions get made on.
     */
    db.from('manual_orders').select('amount, created_at').eq('status', 'delivered'),
    // Money promised but not yet earned. Kept separate rather than folded into
    // the total, so the headline figure never overstates what has been settled.
    db.from('manual_orders').select('amount').eq('status', 'pending'),
    // Phase 2: real gateway orders. Summed now so the total does not appear to
    // reset the day checkout goes live and manual orders stop being created.
    db.from('orders').select('amount').eq('status', 'paid'),
  ])

  const sum = (rows: { amount: number | null }[] | null) =>
    (rows ?? []).reduce((total, r) => total + Number(r.amount ?? 0), 0)

  const deliveredRows = (collectedManual.data as { amount: number | null; created_at: string }[]) ?? []

  const collected = sum(deliveredRows) + sum(collectedGateway.data as { amount: number | null }[])
  const awaiting = sum(pendingManual.data as { amount: number | null }[])
  const completedCount = deliveredRows.length + ((collectedGateway.data as unknown[]) ?? []).length

  // Rolling 30 days, so the headline total has something to be read against —
  // a lifetime figure alone cannot tell you whether sales are still happening.
  const thirtyDaysAgo = Date.now() - 30 * 86400000
  const last30 = deliveredRows
    .filter((r) => new Date(r.created_at).getTime() >= thirtyDaysAgo)
    .reduce((total, r) => total + Number(r.amount ?? 0), 0)

  interface OrderRow {
    id: string
    buyer_email: string
    buyer_name: string | null
    amount: number | null
    currency: string
    status: string
    created_at: string
    products: { title: string } | { title: string }[] | null
  }

  const orders = (recentOrders.data ?? []) as unknown as OrderRow[]

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where things stand right now."
        action={
          <Button asChild variant="cta" size="md">
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4" aria-hidden />
              New product
            </Link>
          </Button>
        }
      />

      {/* The money figure gets its own full-width row. It is the number that
          gets looked at first, and putting it in the four-up grid made it one
          tile among four counters of unrelated things. */}
      <TotalEarned collected={collected} awaiting={awaiting} sales={completedCount} last30={last30} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Orders waiting"
          value={pendingOrders.count ?? 0}
          hint={awaiting > 0 ? `${formatPrice(awaiting)} to collect` : 'Need a file sent'}
          href="/admin/orders"
          accent={(pendingOrders.count ?? 0) > 0}
        />
        <StatCard label="Completed sales" value={completedCount} hint="Files delivered" />
        <StatCard
          label="Live products"
          value={active.count ?? 0}
          hint={`${products.count ?? 0} total`}
          href="/admin/products"
        />
        <StatCard
          label="Reviews to moderate"
          value={pendingReviews.count ?? 0}
          href="/admin/reviews"
          accent={(pendingReviews.count ?? 0) > 0}
        />
      </div>

      {(products.count ?? 0) === 0 && (
        <Card className="mt-6 p-6">
          <h2 className="text-lg">Start here</h2>
          <ol className="mt-3 space-y-2 text-sm text-brand-body">
            <li>1. Add a category or two, so products have somewhere to live.</li>
            <li>2. Create your first product, upload the file and a cover image.</li>
            <li>3. Set its status to Active — it appears on the storefront within a minute.</li>
            <li>4. Share the link. Orders land in the Orders tab, where you send the file.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="cta" size="md">
              <Link href="/admin/products/new">Create first product</Link>
            </Button>
            <Button asChild variant="outline" size="md">
              <Link href="/admin/categories">Add categories</Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="text-lg">Latest orders</h2>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 font-heading text-xs font-bold uppercase tracking-wide text-brand-cta hover:underline"
          >
            All orders
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {orders.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-brand-body">
              No orders yet. They appear here the moment someone submits the buy form.
            </p>
          </Card>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Buyer</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-brand-heading">
                    {one(o.products)?.title ?? '— deleted product —'}
                  </Td>
                  <Td>
                    <span className="block text-brand-heading">{o.buyer_name ?? '—'}</span>
                    <span className="text-xs text-brand-body/70">{o.buyer_email}</span>
                  </Td>
                  <Td>{formatPrice(o.amount, o.currency)}</Td>
                  <Td>
                    <StatusPill status={o.status} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="block text-xs font-medium text-brand-heading">
                      {formatRelative(o.created_at)}
                    </span>
                    <LocalTime iso={o.created_at} className="block text-[11px] text-brand-body/60" />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  )
}

/**
 * Total money in, with the two figures that stop it being misread: what is still
 * owed, and how much of the total arrived in the last 30 days.
 *
 * "Collected" deliberately excludes pending orders. Phase 1 has no gateway, so a
 * submitted order is a request to buy, not a payment — a total that counted them
 * would report money that may never arrive.
 */
function TotalEarned({
  collected,
  awaiting,
  sales,
  last30,
}: {
  collected: number
  awaiting: number
  sales: number
  last30: number
}) {
  return (
    <div className="rounded-lg border border-brand-cta/25 bg-brand-cream p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
            Total earned
          </p>
          <p className="mt-1.5 font-heading text-5xl font-bold leading-none text-brand-heading">
            {formatPrice(collected)}
          </p>
          <p className="mt-2 text-sm text-brand-body">
            {sales === 0
              ? 'No completed sales yet — a sale counts once the file is delivered.'
              : `From ${sales} completed ${sales === 1 ? 'sale' : 'sales'}, all time.`}
          </p>
        </div>

        <dl className="flex gap-8">
          <div>
            <dt className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
              Last 30 days
            </dt>
            <dd className="mt-1.5 font-heading text-2xl font-bold leading-none text-brand-heading">
              {formatPrice(last30)}
            </dd>
          </div>
          <div>
            <dt className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
              Awaiting delivery
            </dt>
            <dd
              className={
                awaiting > 0
                  ? 'mt-1.5 font-heading text-2xl font-bold leading-none text-brand-cta'
                  : 'mt-1.5 font-heading text-2xl font-bold leading-none text-brand-heading'
              }
            >
              {formatPrice(awaiting)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
