import { FileQuestion } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import type { Product } from '@/lib/types'

export function ProductGrid({
  products,
  emptyMessage = 'Nothing here yet.',
  priorityCount = 0,
}: {
  products: Product[]
  emptyMessage?: string
  /** How many covers to mark high-priority — only the ones above the fold. */
  priorityCount?: number
}) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-brand-cream/50 px-6 py-16 text-center">
        <FileQuestion className="h-10 w-10 text-brand-tan" aria-hidden />
        <p className="mt-4 font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
          {emptyMessage}
        </p>
        <p className="mt-1 text-sm text-brand-body">Try a different category or search term.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  )
}
