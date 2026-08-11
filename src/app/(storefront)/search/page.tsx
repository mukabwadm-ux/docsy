import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import { ProductGrid } from '@/components/product-grid'
import { Button } from '@/components/ui/button'
import { searchProducts } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Search',
  // A search results page has nothing durable to offer an index, and letting it
  // in creates unbounded near-duplicate URLs.
  robots: { index: false, follow: true },
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? ''
  const results = q ? await searchProducts(q, 36) : []

  return (
    <div className="container py-10">
      <h1 className="text-3xl sm:text-4xl">Search</h1>

      <form action="/search" method="get" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="search-q" className="sr-only">
          Search products
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="search-q"
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="What are you looking for?"
            className="h-14 w-full rounded-md border border-input bg-white pl-12 pr-4 text-[15px] text-brand-body placeholder:text-muted-foreground focus-visible:border-brand-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta/30"
          />
        </div>
        <Button type="submit" variant="cta" size="lg" className="shrink-0">
          Search
        </Button>
      </form>

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
