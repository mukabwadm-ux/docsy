import Link from 'next/link'
import { AlertTriangle, EyeOff, Lightbulb, TrendingUp } from 'lucide-react'
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from '@/components/admin/ui'
import { LocalTime } from '@/components/admin/local-time'
import { requireAdmin } from '@/lib/auth'
import { formatCompact, formatPrice } from '@/lib/format'
import { getInsights, type ProductPerformance } from '@/lib/insights'

export const dynamic = 'force-dynamic'

export default async function InsightsPage() {
  await requireAdmin()
  const data = await getInsights()

  const earners = [...data.products].filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue)

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="What visitors are doing, and what they wanted and could not find."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Product views" value={formatCompact(data.totals.views)} hint="All time" />
        <StatCard label="Orders placed" value={data.totals.orders} hint="Including pending" />
        <StatCard
          label="Conversion"
          value={data.totals.conversion === null ? '—' : `${data.totals.conversion.toFixed(1)}%`}
          hint="Views that became a completed sale"
        />
        <StatCard label="Revenue" value={formatPrice(data.totals.revenue)} hint="Delivered only" />
      </div>

      {/* ------------------------------------------------- what to fix next */}
      {(data.notConverting.length > 0 || data.noTraffic.length > 0) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.notConverting.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-4 w-4 text-brand-cta" aria-hidden />
                Getting traffic, making no sales
              </h2>
              <p className="mt-1 text-sm text-brand-body">
                People are landing on these and leaving. That points at the price, the copy or the
                proof — not at your marketing.
              </p>
              <ul className="mt-4 space-y-2">
                {data.notConverting.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="truncate text-brand-heading hover:text-brand-cta"
                    >
                      {p.title}
                    </Link>
                    <span className="shrink-0 font-heading text-xs font-bold uppercase tracking-wide text-brand-cta">
                      {formatCompact(p.views)} views · 0 sales
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.noTraffic.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-lg">
                <EyeOff className="h-4 w-4 text-brand-body/60" aria-hidden />
                Nobody has seen these yet
              </h2>
              <p className="mt-1 text-sm text-brand-body">
                Live, but with no views at all. Nothing is wrong with the page — it just has no
                traffic pointed at it.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {data.noTraffic.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="inline-block rounded-full border border-border bg-white px-3 py-1 text-xs text-brand-heading hover:border-brand-cta hover:text-brand-cta"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* --------------------------------------------------- demand signal */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-4 w-4 text-brand-cta" aria-hidden />
          Searched for, and not found
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-brand-body">
          Every one of these is somebody who arrived wanting to buy something you do not sell yet.
          The number is how many times it has been searched.
        </p>

        <div className="mt-4">
          {data.emptySearches.length === 0 ? (
            <EmptyState
              title="No empty searches recorded"
              hint="Searches that return nothing show up here — including the ones where the visitor gave up without pressing Enter."
            />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.emptySearches.map((s) => (
                <li
                  key={s.normalized}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-cta/30 bg-brand-cream px-3.5 py-1.5"
                >
                  <span className="text-sm text-brand-heading">{s.sample}</span>
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-cta">
                    {s.hits}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* -------------------------------------------------- all searches */}
      {data.searches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg">Every search</h2>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Query</Th>
                  <Th>Times</Th>
                  <Th>Results</Th>
                  <Th>Last searched</Th>
                </tr>
              </thead>
              <tbody>
                {data.searches.map((s) => (
                  <tr key={s.normalized}>
                    <Td className="text-brand-heading">{s.sample}</Td>
                    <Td>{s.hits}</Td>
                    <Td>
                      {s.result_count === 0 ? (
                        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-cta">
                          Nothing found
                        </span>
                      ) : (
                        s.result_count
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-brand-body/70">
                      <LocalTime iso={s.last_seen} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- top earners */}
      {earners.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-4 w-4 text-brand-cta" aria-hidden />
            Top earners
          </h2>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Revenue</Th>
                  <Th>Completed</Th>
                </tr>
              </thead>
              <tbody>
                {earners.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-brand-heading hover:text-brand-cta"
                      >
                        {p.title}
                      </Link>
                    </Td>
                    <Td className="font-heading font-bold text-brand-heading">
                      {formatPrice(p.revenue, p.currency)}
                    </Td>
                    <Td>{p.completed}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- per-product funnel */}
      <section className="mt-8">
        <h2 className="text-lg">Every product</h2>
        <p className="mt-1 text-sm text-brand-body">
          Views are counted for the whole life of the product, so conversion here is all-time rather
          than for a window.
        </p>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Views</Th>
                <Th>Orders</Th>
                <Th>Completed</Th>
                <Th>Conversion</Th>
                <Th>Revenue</Th>
                <Th>Rating</Th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="text-brand-heading hover:text-brand-cta"
                    >
                      {p.title}
                    </Link>
                    {p.status !== 'active' && (
                      <span className="ml-2 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body/60">
                        {p.status}
                      </span>
                    )}
                  </Td>
                  <Td>{formatCompact(p.views)}</Td>
                  <Td>{p.orders}</Td>
                  <Td>{p.completed}</Td>
                  <Td>
                    <ConversionCell product={p} />
                  </Td>
                  <Td>{p.revenue > 0 ? formatPrice(p.revenue, p.currency) : '—'}</Td>
                  <Td className="whitespace-nowrap text-xs text-brand-body/70">
                    {p.ratingCount > 0 ? `${p.ratingAvg.toFixed(1)}★ (${p.ratingCount})` : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </section>
    </>
  )
}

function ConversionCell({ product }: { product: ProductPerformance }) {
  if (product.conversion === null) {
    return <span className="text-xs text-brand-body/50">no views yet</span>
  }
  const strong = product.conversion >= 2
  return (
    <span
      className={
        strong
          ? 'font-heading text-sm font-bold text-green-700'
          : 'font-heading text-sm font-bold text-brand-body'
      }
    >
      {product.conversion.toFixed(1)}%
    </span>
  )
}
