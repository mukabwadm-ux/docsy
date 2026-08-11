'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { CatalogSort, Category } from '@/lib/types'

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Best selling' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

export function CatalogFilters({
  categories,
  activeCategory,
  activeSort,
  total,
}: {
  categories: Category[]
  activeCategory?: string
  activeSort: CatalogSort
  total: number
}) {
  const router = useRouter()
  const params = useSearchParams()

  /**
   * Changing a filter always returns to page 1. Staying on page 4 while
   * switching to a category with two products lands the visitor on an empty
   * grid that looks like a bug.
   */
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    next.delete('page')
    router.push(`/products${next.toString() ? `?${next}` : ''}`, { scroll: false })
  }

  function categoryHref(slug: string | null) {
    const next = new URLSearchParams(params.toString())
    if (slug === null) next.delete('category')
    else next.set('category', slug)
    next.delete('page')
    return `/products${next.toString() ? `?${next}` : ''}`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Real links, so a category is shareable and crawlable — a click handler
          alone would leave these invisible to search engines. */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <FilterPill href={categoryHref(null)} active={!activeCategory}>
          All
        </FilterPill>
        {categories.map((c) => (
          <FilterPill key={c.id} href={categoryHref(c.slug)} active={activeCategory === c.slug}>
            {c.name}
          </FilterPill>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-body">
          {total} {total === 1 ? 'product' : 'products'}
        </p>

        <div className="flex items-center gap-2">
          <label
            htmlFor="sort"
            className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body/70"
          >
            Sort
          </label>
          <select
            id="sort"
            value={activeSort}
            onChange={(e) => setParam('sort', e.target.value)}
            className="h-10 rounded-md border border-input bg-white px-3 pr-8 font-heading text-sm font-bold uppercase tracking-wide text-brand-heading focus-visible:border-brand-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta/30"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 font-heading text-sm font-bold uppercase tracking-wide transition-colors',
        active
          ? 'border-brand-cta bg-brand-cta text-white'
          : 'border-border bg-white text-brand-body hover:border-brand-cta hover:text-brand-cta'
      )}
    >
      {children}
    </Link>
  )
}
