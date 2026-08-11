import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
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

  const [products, active, pendingOrders, deliveredOrders, pendingReviews, recentOrders, revenueRows] =
    await Promise.all([
      db.from('products').select('id', { count: 'exact', head: true }),
      db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('manual_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db
        .from('manual_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'delivered'),
      db.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db
        .from('manual_orders')
        .select('id, buyer_email, buyer_name, amount, currency, status, created_at, products ( title )')
        .order('created_at', { ascending: false })
        .limit(8),
      // Only delivered orders count as revenue — a pending request is an
      // intention, and counting it would inflate the only number here that
      // anyone will make decisions on.
      db.from('manual_orders').select('amount').eq('status', 'delivered'),
    ])

  const revenue = ((revenueRows.data as { amount: number | null }[]) ?? []).reduce(
    (sum, r) => sum + Number(r.amount ?? 0),
    0
  )

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Orders waiting"
          value={pendingOrders.count ?? 0}
          hint="Need a file sent"
          href="/admin/orders"
          accent={(pendingOrders.count ?? 0) > 0}
        />
        <StatCard
          label="Revenue delivered"
          value={formatPrice(revenue)}
          hint={`${deliveredOrders.count ?? 0} fulfilled`}
        />
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
                  <Td className="whitespace-nowrap text-xs text-brand-body/70">
                    {formatRelative(o.created_at)}
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
