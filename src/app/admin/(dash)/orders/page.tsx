import Link from 'next/link'
import { DeliveryPanel } from '@/components/admin/delivery-panel'
import { LocalTime } from '@/components/admin/local-time'
import { EmptyState, PageHeader, StatusPill, Table, Td, Th } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { EMAIL_SETUP_HINT, isEmailConfigured } from '@/lib/email'
import { formatPrice, formatRelative } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface OrderRow {
  id: string
  buyer_email: string
  buyer_name: string | null
  note: string | null
  amount: number | null
  currency: string
  status: 'pending' | 'delivered'
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'
  payment_provider: string | null
  payment_reference: string | null
  base_amount: number | null
  delivered_at: string | null
  created_at: string
  products: { id: string; title: string; file_url: string | null } | null
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  await requireAdmin()
  const emailConfigured = isEmailConfigured()
  const filter = searchParams.filter === 'delivered' ? 'delivered' : searchParams.filter === 'all' ? 'all' : 'pending'

  let query = createAdminClient()
    .from('manual_orders')
    .select(
      'id, buyer_email, buyer_name, note, amount, currency, base_amount, status, payment_status, payment_provider, payment_reference, delivered_at, created_at, products ( id, title, file_url )'
    )
    // Oldest first within the pending queue: the person who has been waiting
    // longest should be served first, which is the opposite of the newest-first
    // ordering every other admin list wants.
    .order('created_at', { ascending: filter === 'pending' })

  if (filter !== 'all') query = query.eq('status', filter)

  const { data } = await query.limit(200)
  const orders = (data ?? []) as unknown as OrderRow[]

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={
          emailConfigured
            ? 'One click sends the file and marks the order delivered. Links expire after 7 days.'
            : 'Send the file, then mark it sent. Links expire after 7 days.'
        }
      />

      {!emailConfigured && (
        <div className="mb-4 rounded-lg border border-brand-tan bg-brand-cream p-4">
          <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
            Delivery is manual right now
          </p>
          <p className="mt-1 text-sm text-brand-body">
            {EMAIL_SETUP_HINT} Until then, use <strong>Get link</strong> and your own mail client —
            everything below still works.
          </p>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {[
          { key: 'pending', label: 'Waiting' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'all', label: 'All' },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?filter=${t.key}`}
            className={
              filter === t.key
                ? 'rounded-full border border-brand-cta bg-brand-cta px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide text-white'
                : 'rounded-full border border-border bg-white px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide text-brand-body hover:border-brand-cta hover:text-brand-cta'
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'Nothing waiting' : 'No orders here'}
          hint={
            filter === 'pending'
              ? 'Every order has been delivered. New ones appear here automatically.'
              : 'Orders show up the moment a buyer submits the form on a product page.'
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Buyer</Th>
              <Th>Product</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Ordered</Th>
              <Th className="text-right">Deliver</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <Td>
                  <span className="block font-medium text-brand-heading">
                    {o.buyer_name ?? '—'}
                  </span>
                  <a
                    href={`mailto:${o.buyer_email}`}
                    className="text-xs text-brand-body/70 hover:text-brand-cta"
                  >
                    {o.buyer_email}
                  </a>
                  {o.note && (
                    <span className="mt-1 block max-w-xs rounded bg-brand-cream px-2 py-1 text-xs italic text-brand-body">
                      “{o.note}”
                    </span>
                  )}
                </Td>

                <Td>
                  {o.products ? (
                    <>
                      <Link
                        href={`/admin/products/${o.products.id}`}
                        className="text-brand-heading hover:text-brand-cta"
                      >
                        {o.products.title}
                      </Link>
                      {!o.products.file_url && (
                        <span className="mt-1 block font-heading text-[10px] font-bold uppercase tracking-wider text-red-600">
                          No file attached
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-brand-body/60">— deleted product —</span>
                  )}
                </Td>

                <Td className="whitespace-nowrap">
                  {formatPrice(o.amount, o.currency)}
                  {/* The USD equivalent, when the buyer paid in shillings. Every
                      revenue total is in USD, so this is what reconciles. */}
                  {o.currency !== 'USD' && o.base_amount !== null && (
                    <span className="mt-0.5 block text-[11px] text-brand-body/60">
                      = {formatPrice(o.base_amount, 'USD')}
                    </span>
                  )}
                </Td>

                <Td>
                  <StatusPill status={o.status} />
                  {o.payment_status === 'paid' ? (
                    <span className="mt-1 block font-heading text-[10px] font-bold uppercase tracking-wider text-green-700">
                      Paid{o.payment_provider === 'paystack' ? ' · Paystack' : ''}
                    </span>
                  ) : o.payment_status === 'pending' ? (
                    <span className="mt-1 block font-heading text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Payment started
                    </span>
                  ) : o.payment_status === 'failed' ? (
                    <span className="mt-1 block font-heading text-[10px] font-bold uppercase tracking-wider text-red-600">
                      Payment failed
                    </span>
                  ) : (
                    <span className="mt-1 block font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body/50">
                      Unpaid
                    </span>
                  )}
                  {o.delivered_at && (
                    <LocalTime
                      iso={o.delivered_at}
                      className="mt-1 block text-[11px] text-brand-body/60"
                    />
                  )}
                </Td>

                <Td className="whitespace-nowrap">
                  <span className="block text-xs font-medium text-brand-heading">
                    {formatRelative(o.created_at)}
                  </span>
                  <LocalTime iso={o.created_at} className="block text-[11px] text-brand-body/60" />
                </Td>

                <Td>
                  {o.products ? (
                    <DeliveryPanel
                      orderId={o.id}
                      buyerEmail={o.buyer_email}
                      buyerName={o.buyer_name}
                      productTitle={o.products.title}
                      delivered={o.status === 'delivered'}
                      emailConfigured={emailConfigured}
                      emailHint={EMAIL_SETUP_HINT}
                    />
                  ) : (
                    <span className="block text-right text-xs text-brand-body/60">
                      Nothing to send
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
