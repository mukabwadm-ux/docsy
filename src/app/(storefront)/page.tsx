import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Download,
  FileText,
  LayoutTemplate,
  Palette,
  PenTool,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'
import { ProductGrid } from '@/components/product-grid'
import { Button } from '@/components/ui/button'
import { getCategoriesWithCounts, getFeaturedProducts, getLatestProducts } from '@/lib/queries'

export const revalidate = 60

/** Category icon names map to lucide components here — the DB stores a string. */
const ICONS: Record<string, typeof BookOpen> = {
  'book-open': BookOpen,
  'layout-template': LayoutTemplate,
  palette: Palette,
  'pen-tool': PenTool,
  'file-text': FileText,
  sparkles: Sparkles,
}

export default async function HomePage() {
  const [featured, latest, categories] = await Promise.all([
    getFeaturedProducts(8),
    getLatestProducts(8),
    getCategoriesWithCounts(),
  ])

  // Before anything is featured, the row would render empty and the homepage
  // would look broken on launch day. Fall back to whatever exists.
  const heroRow = featured.length > 0 ? featured : latest
  const hasCatalog = latest.length > 0

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="border-b border-brand-tan bg-brand-cream">
        <div className="container grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-20">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-cta">
              Digital downloads · Instant access
            </p>

            <h1 className="mt-4 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              Templates and guides
              <br />
              you can use today
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-body">
              No fluff, no 300-page theory. Every Docsy product is a finished tool — fill it in,
              swap your logo, ship it. Buy once, download instantly, keep it forever.
            </p>

            <form action="/search" method="get" className="mt-8 flex max-w-lg gap-2">
              <label htmlFor="hero-search" className="sr-only">
                Search products
              </label>
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id="hero-search"
                  type="search"
                  name="q"
                  placeholder="Try “budget spreadsheet” or “pitch deck”"
                  className="h-14 w-full rounded-md border border-input bg-white pl-12 pr-4 text-[15px] text-brand-body placeholder:text-muted-foreground focus-visible:border-brand-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta/30"
                />
              </div>
              <Button type="submit" variant="cta" size="lg" className="shrink-0">
                Search
              </Button>
            </form>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {[
                { icon: Zap, text: 'Instant download' },
                { icon: Download, text: 'Lifetime access' },
                { icon: Sparkles, text: 'Free updates' },
              ].map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wide text-brand-heading"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-cta text-white">
                    <Icon className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Editorial stack rather than a stock photo — there is no single
              product image that represents a whole catalog.

              The three cards are positioned against this wrapper, so the wrapper
              is given the cluster's own width (the mid card reaches 20rem, and
              rotation carries it to ~20.8rem) instead of being left to stretch
              across the whole grid track. Without an intrinsic width there is
              nothing for justify-self-end to align, and the stack stays pinned
              to the left edge of the track — right up against the copy. */}
          <div className="relative hidden lg:block lg:w-[21rem] lg:justify-self-end">
            <div className="absolute -left-4 top-8 h-64 w-52 rotate-[-8deg] rounded-lg border border-brand-tan bg-white shadow-card" />
            <div className="absolute left-24 top-2 h-72 w-56 rotate-[5deg] rounded-lg border border-brand-tan bg-brand-tan/40 shadow-card" />
            <div className="relative ml-10 flex h-80 w-64 flex-col justify-between rounded-lg border border-brand-heading/10 bg-white p-6 shadow-card-hover">
              <div>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-cta text-white">
                  <FileText className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </span>
                <p className="mt-4 font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
                  Included
                </p>
                <ul className="mt-3 space-y-2 text-sm text-brand-body">
                  {['Editable source files', 'Step-by-step guide', 'Commercial licence'].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-cta" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="font-heading text-3xl font-bold text-brand-heading">$19+</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ featured */}
      {heroRow.length > 0 && (
        <section className="container py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl">
                {featured.length > 0 ? 'Featured products' : 'Latest products'}
              </h2>
              <p className="mt-2 text-brand-body">Hand-picked, ready to download.</p>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 font-heading text-sm font-bold uppercase tracking-wide text-brand-cta hover:underline"
            >
              Browse all
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-8">
            <ProductGrid products={heroRow} priorityCount={4} />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- categories */}
      {categories.length > 0 && (
        <section className="border-y border-brand-tan bg-brand-cream/60 py-14">
          <div className="container">
            <h2 className="text-2xl sm:text-3xl">Browse by category</h2>
            <p className="mt-2 text-brand-body">Find the format you need.</p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => {
                const Icon = ICONS[c.icon ?? ''] ?? FileText
                return (
                  <Link
                    key={c.id}
                    href={`/products?category=${c.slug}`}
                    className="group flex flex-col gap-3 rounded-lg border border-brand-tan bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-cta hover:shadow-card-hover"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-cream text-brand-cta transition-colors group-hover:bg-brand-cta group-hover:text-white">
                      <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-base transition-colors group-hover:text-brand-cta">
                        {c.name}
                      </h3>
                      <p className="mt-0.5 font-heading text-xs font-bold uppercase tracking-wide text-brand-body/70">
                        {c.product_count} {c.product_count === 1 ? 'product' : 'products'}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------- latest / empty */}
      {hasCatalog ? (
        featured.length > 0 && (
          <section className="container py-14">
            <h2 className="text-2xl sm:text-3xl">Just added</h2>
            <div className="mt-8">
              <ProductGrid products={latest} />
            </div>
          </section>
        )
      ) : (
        <section className="container py-20 text-center">
          <h2 className="text-2xl">The shelves are still being stocked</h2>
          <p className="mx-auto mt-3 max-w-md text-brand-body">
            No products are published yet. Add your first one from the admin panel and it will
            appear here.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-6">
            <Link href="/admin">Go to admin</Link>
          </Button>
        </section>
      )}
    </>
  )
}
