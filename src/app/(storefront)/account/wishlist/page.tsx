import type { Metadata } from 'next'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import { Button } from '@/components/ui/button'
import { requireBuyer } from '@/lib/buyer'
import { getWishlist } from '@/lib/account-data'
import type { Product } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your wishlist', robots: { index: false, follow: false } }

export default async function WishlistPage() {
  const session = await requireBuyer('/account/wishlist')
  const items = await getWishlist(session.userId)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl">Your wishlist</h2>
        {items.length > 0 && (
          <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-body/70">
            {items.length} saved
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-brand-cream/40 px-6 py-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-brand-tan" aria-hidden />
          <p className="mt-4 font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
            Nothing saved yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-brand-body">
            Tap the heart on any product to keep it here for later.
          </p>
          <Button asChild variant="cta" size="md" className="mt-5">
            <Link href="/products">Browse the shop</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              // getWishlist drops rows whose product was unpublished, so this is
              // a real product; the cast supplies the card's optional fields.
              product={
                {
                  ...item.product!,
                  benefits: [],
                  story_content: [],
                  how_it_works: [],
                  announcement_text: null,
                  description: null,
                  short_description: null,
                  category_id: null,
                  file_size_mb: null,
                  is_featured: false,
                  views_count: 0,
                  sales_count: 0,
                  status: 'active',
                  created_at: item.created_at,
                  updated_at: item.created_at,
                } as Product
              }
              savedInWishlist
            />
          ))}
        </div>
      )}
    </>
  )
}
