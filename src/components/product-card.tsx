import Image from 'next/image'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { StarRating } from '@/components/star-rating'
import { WishlistButton } from '@/components/wishlist-button'
import { Badge } from '@/components/ui/badge'
import { discountPercent, fileTypeLabel, formatPriceOrFree } from '@/lib/format'
import type { Product } from '@/lib/types'

export function ProductCard({
  product,
  priority = false,
  savedInWishlist = false,
}: {
  product: Product
  priority?: boolean
  savedInWishlist?: boolean
}) {
  const cover = product.preview_image_url ?? product.product_images?.[0]?.image_url ?? null
  const off = discountPercent(product.price, product.compare_at_price)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta"
    >
      <div className="relative aspect-cover overflow-hidden bg-brand-cream">
        <WishlistButton productId={product.id} saved={savedInWishlist} />
        {cover ? (
          <Image
            src={cover}
            alt={product.title}
            fill
            // Two columns on phones, up to four on desktop. Getting this wrong
            // is invisible locally and doubles image bytes on a real phone.
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileText className="h-10 w-10 text-brand-tan" aria-hidden />
          </div>
        )}

        {off !== null && (
          <Badge variant="cta" className="absolute left-3 top-3">
            {off}% off
          </Badge>
        )}
        {product.is_featured && off === null && (
          <Badge variant="dark" className="absolute left-3 top-3">
            Featured
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {product.file_type && (
          <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/70">
            {fileTypeLabel(product.file_type)}
          </p>
        )}

        <h3 className="mt-1 line-clamp-2 text-base leading-snug transition-colors group-hover:text-brand-cta">
          {product.title}
        </h3>

        {product.rating_count > 0 ? (
          <div className="mt-2">
            <StarRating value={product.rating_avg} count={product.rating_count} size="sm" />
          </div>
        ) : (
          product.sales_count > 0 && (
            <p className="mt-2 font-heading text-xs font-bold uppercase tracking-wide text-brand-body/70">
              {product.sales_count.toLocaleString('en-US')} sold
            </p>
          )
        )}

        <div className="mt-auto flex items-end gap-2 pt-3">
          <span className="font-heading text-xl font-bold text-brand-heading">
            {formatPriceOrFree(product.price, product.currency)}
          </span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="font-heading text-sm text-brand-body/60 line-through">
              {formatPriceOrFree(product.compare_at_price, product.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
