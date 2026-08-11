import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductGrid } from '@/components/product-grid'
import { SearchAutocomplete } from '@/components/search-autocomplete'
import { recordSearch } from '@/lib/insights'
import { searchCategories, searchProducts } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Search',
  // A search results page has nothing durable to offer an index, and letting it
  // in creates unbounded near-duplicate URLs.
  robots: { index: false, follow: true },
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? ''
  const [results, categories] = q
    ? await Promise.all([searchProducts(q, 36), searchCategories(q, 4)])
    : [[], []]

  // A rendered results page is a deliberate search, so it is worth recording
  // whatever it found. Awaited rather than fired off loose: an unawaited promise
  // in a server component can be cut short when the response is sent.
  if (q) await recordSearch(q, results.length)

  return (
    <div className="container py-10">
      <h1 className="text-3xl sm:text-4xl">Search</h1>

      <div className="mt-6">
        <SearchAutocomplete variant="hero" defaultValue={q} autoFocus placeholder="What are you looking for?" />
      </div>

      {q && categories.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body/70">
            Categories
          </span>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className="rounded-full border border-brand-tan bg-brand-cream px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {q && (
        <p className="mt-6 font-heading text-sm font-bold uppercase tracking-wide text-brand-body">
          {results.length} {results.length === 1 ? 'result' : 'results'} for “{q}”
        </p>
      )}

      <div className="mt-8">
        {q ? (
          <ProductGrid
            products={results}
            priorityCount={4}
            emptyMessage={`Nothing matched “${q}”`}
          />
        ) : (
          <p className="text-brand-body">Type something above to search the catalog.</p>
        )}
      </div>
    </div>
  )
}
