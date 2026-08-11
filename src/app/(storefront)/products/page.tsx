import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CatalogFilters } from '@/components/catalog-filters'
import { Pagination } from '@/components/pagination'
import { ProductGrid } from '@/components/product-grid'
import { getCatalog, getCategories } from '@/lib/queries'
import type { CatalogSort } from '@/lib/types'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'All products',
  description:
    'Every Docsy download — ebooks, templates, guides and design assets. Filter by category and sort by price or rating.',
  alternates: { canonical: '/products' },
}

const VALID_SORTS: CatalogSort[] = ['newest', 'popular', 'rating', 'price-asc', 'price-desc']

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; sort?: string; page?: string }
}) {
  // Anything unparseable falls back to a sane default rather than 500ing —
  // these values arrive from the URL bar and from stale bookmarks.
  const sort = VALID_SORTS.includes(searchParams.sort as CatalogSort)
    ? (searchParams.sort as CatalogSort)
    : 'newest'
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)
  const category = searchParams.category?.trim() || undefined

  const [categories, catalog] = await Promise.all([
    getCategories(),
    getCatalog({ category, sort, page, perPage: 12 }),
  ])

  const activeCategory = categories.find((c) => c.slug === category)

  function buildHref(nextPage: number) {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (sort !== 'newest') params.set('sort', sort)
    if (nextPage > 1) params.set('page', String(nextPage))
    return `/products${params.toString() ? `?${params}` : ''}`
  }

  return (
    <div className="container py-10">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl">{activeCategory ? activeCategory.name : 'All products'}</h1>
        <p className="mt-2 max-w-2xl text-brand-body">
          {activeCategory?.description ??
            'Every download in the shop. Buy once, use forever — no subscription.'}
        </p>
      </header>

      {/* useSearchParams in the filter bar needs a Suspense boundary to keep
          the rest of this page statically renderable. */}
      <Suspense fallback={<div className="h-28" />}>
        <CatalogFilters
          categories={categories}
          activeCategory={category}
          activeSort={sort}
          total={catalog.total}
        />
      </Suspense>

      <div className="mt-8">
        <ProductGrid
          products={catalog.products}
          priorityCount={4}
          emptyMessage={category ? 'Nothing in this category yet' : 'No products published yet'}
        />
      </div>

      <Pagination page={catalog.page} totalPages={catalog.totalPages} buildHref={buildHref} />
    </div>
  )
}
