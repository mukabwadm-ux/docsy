import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, ChevronRight, Clock, Download, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { BuyPanel } from '@/components/buy-panel'
import { HowItWorks } from '@/components/how-it-works'
import { ProductCard } from '@/components/product-card'
import { ProductGallery } from '@/components/product-gallery'
import { ReviewSection } from '@/components/review-section'
import { StarRating } from '@/components/star-rating'
import { StickyCta } from '@/components/sticky-cta'
import { StoryBlocks } from '@/components/story-blocks'
import { ViewCounter } from '@/components/view-counter'
import { WishlistButton } from '@/components/wishlist-button'
import { Button } from '@/components/ui/button'
import { fileTypeLabel } from '@/lib/format'
import {
  getAllProductSlugs,
  getProductBySlug,
  getRelatedProducts,
  getReviews,
} from '@/lib/queries'
import { getBuyerSession } from '@/lib/buyer'
import { getRates } from '@/lib/currency'
import { getWishlistIds } from '@/lib/account-data'

export const revalidate = 60
export const dynamicParams = true

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs().catch(() => [])
  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const product = await getProductBySlug(params.slug)
  if (!product) return { title: 'Product not found' }

  const image = product.preview_image_url ?? product.product_images?.[0]?.image_url

  return {
    title: product.title,
    description: product.short_description ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.short_description ?? undefined,
      type: 'website',
      images: image ? [{ url: image, width: 1200, height: 1500 }] : undefined,
    },
  }
}

const TRUST_BADGES = [
  { icon: Download, label: 'Instant\nDownload' },
  { icon: RefreshCw, label: 'Free\nUpdates' },
  { icon: ShieldCheck, label: 'Secure\nOrder' },
]

/**
 * The conversion layout, in the reference's order:
 *   announcement bar → hero (proof, title, benefits, CTA, trust icons)
 *   → story blocks → how-it-works → reviews → related, with a sticky mobile CTA.
 *
 * The section order is the whole point and is not driven by data: a seller can
 * leave story blocks or steps empty and those sections disappear, but they can
 * never end up out of order.
 */
export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug)
  if (!product) notFound()

  const [reviews, related, buyer, rates] = await Promise.all([
    getReviews(product.id),
    getRelatedProducts(product),
    // Reading the session makes this route dynamic, which is why the page keeps
    // its own `revalidate` for the anonymous case and the saved state is the only
    // per-visitor bit rendered here.
    getBuyerSession(),
    getRates(),
  ])
  const savedIds = buyer ? await getWishlistIds(buyer.userId) : new Set<string>()

  const category = product.categories

  return (
    <>
      <ViewCounter productId={product.id} />
      <ProductJsonLd product={product} reviewCount={reviews.length} />

      {/* ------------------------------------------- announcement bar */}
      {product.announcement_text && (
        <div className="bg-brand-tan">
          <p className="container py-2.5 text-center font-heading text-xs font-bold uppercase tracking-wider text-brand-heading sm:text-sm">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-brand-cta" aria-hidden />
            {product.announcement_text}
          </p>
        </div>
      )}

      {/* -------------------------------------------------------- hero */}
      <section id="product-hero" className="border-b border-border">
        <div className="grid lg:grid-cols-2">
          <ProductGallery
            images={product.product_images ?? []}
            title={product.title}
            fallbackImage={product.preview_image_url}
          />

          <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
            <nav
              aria-label="Breadcrumb"
              className="mb-5 flex flex-wrap items-center gap-1 text-xs text-brand-body/70"
            >
              <Link href="/" className="hover:text-brand-cta">
                Home
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <Link href="/products" className="hover:text-brand-cta">
                Products
              </Link>
              {category && (
                <>
                  <ChevronRight className="h-3 w-3" aria-hidden />
                  <Link href={`/products?category=${category.slug}`} className="hover:text-brand-cta">
                    {category.name}
                  </Link>
                </>
              )}
            </nav>

            {/* Social proof above the headline, as in the reference — it frames
                the title rather than having to be discovered below it. */}
            {product.rating_count > 0 ? (
              <a href="#reviews" className="flex w-fit items-center gap-2 hover:opacity-80">
                <StarRating value={product.rating_avg} size="sm" />
                <span className="font-heading text-xs font-bold uppercase tracking-wide text-brand-body">
                  {product.rating_count.toLocaleString('en-US')}+{' '}
                  {product.rating_avg >= 4.5 ? '5-star reviews' : 'reviews'}
                </span>
              </a>
            ) : (
              product.sales_count > 0 && (
                <p className="font-heading text-xs font-bold uppercase tracking-wide text-brand-body">
                  {product.sales_count.toLocaleString('en-US')} downloads
                </p>
              )
            )}

            <h1 className="mt-3 text-3xl leading-[1.1] sm:text-4xl lg:text-[2.75rem]">
              {product.title}
            </h1>

            {product.short_description && (
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-brand-body">
                {product.short_description}
              </p>
            )}

            {product.benefits.length > 0 && (
              <ul className="mt-6 space-y-3 border-b border-brand-heading/15 pb-6">
                {product.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-cta text-white">
                      <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
                    </span>
                    <span className="text-[15px] leading-relaxed text-brand-body">{benefit}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6">
              <BuyPanel product={product} rates={rates} id="buy" />
            </div>

            <div className="mt-4">
              <WishlistButton
                productId={product.id}
                saved={savedIds.has(product.id)}
                variant="full"
                returnTo={`/products/${product.slug}`}
              />
            </div>

            <ul className="mt-8 grid grid-cols-3 gap-4 border-t border-brand-heading/10 pt-6">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex flex-col items-center gap-2 text-center">
                  <Icon className="h-6 w-6 text-brand-heading" strokeWidth={1.75} aria-hidden />
                  <span className="whitespace-pre-line font-body text-xs leading-tight text-brand-body">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ story blocks */}
      <StoryBlocks blocks={product.story_content} />

      {/* --------------------------------- long description fallback */}
      {product.story_content.length === 0 && product.description && (
        <section className="container py-14 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl sm:text-3xl">About this download</h2>
            <div className="prose-sales mt-5">
              {product.description
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------- how it works */}
      <HowItWorks
        steps={product.how_it_works}
        heading={`What you get with ${product.title}`}
        intro={
          product.file_type
            ? `Delivered as ${fileTypeLabel(product.file_type)}. Yours to keep, with every future update included.`
            : undefined
        }
      />

      {/* -------------------------------------------- mid-page repeat */}
      <section className="container py-14 text-center lg:py-20">
        <h2 className="mx-auto max-w-2xl text-2xl leading-snug sm:text-3xl">
          Ready to put it to work?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[17px] leading-relaxed text-brand-body">
          Download it in the next few minutes and start using it today.
        </p>
        <Button asChild variant="cta" size="xl" className="mt-7">
          <a href="#buy">Get instant access →</a>
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand-body/70">
          <Clock className="h-3 w-3" aria-hidden />
          Takes under a minute
        </p>
      </section>

      {/* ----------------------------------------------------- reviews */}
      <ReviewSection
        productId={product.id}
        reviews={reviews}
        ratingAvg={product.rating_avg}
        ratingCount={product.rating_count}
      />

      {/* ----------------------------------------------------- related */}
      {related.length > 0 && (
        <section className="border-t border-border">
          <div className="container py-14">
            <h2 className="text-2xl sm:text-3xl">You might also like</h2>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} savedInWishlist={savedIds.has(p.id)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Extra bottom room so the sticky bar never covers the footer links. */}
      <div className="h-20 md:hidden" aria-hidden />

      <StickyCta price={product.price} rates={rates} targetId="buy" watchId="product-hero" />
    </>
  )
}

function ProductJsonLd({ product, reviewCount }: { product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>; reviewCount: number }) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.short_description ?? undefined,
    image: [
      product.preview_image_url,
      ...(product.product_images ?? []).map((i) => i.image_url),
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency,
      availability: 'https://schema.org/InStock',
      url: `/products/${product.slug}`,
    },
  }

  // Only claim an aggregate rating when one exists. An empty aggregateRating
  // block is a structured-data error in Search Console, and claiming reviews
  // that are not on the page risks a manual action.
  if (product.rating_count > 0 && reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating_avg,
      reviewCount: product.rating_count,
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
