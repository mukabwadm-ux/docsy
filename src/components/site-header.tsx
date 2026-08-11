import Link from 'next/link'
import { FileText, Search } from 'lucide-react'
import { getCategories } from '@/lib/queries'

/**
 * Minimal nav, per the reference: wordmark, a short category list, search.
 *
 * There is deliberately no cart and no account menu. Every product is a
 * single-item purchase, so a cart would be a step that exists only to be
 * clicked through, and an account has nothing to hold until real checkout
 * issues download tokens.
 */
export async function SiteHeader() {
  const categories = await getCategories()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container flex h-16 items-center gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-cta text-white">
            <FileText className="h-4.5 w-4.5" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="font-heading text-2xl font-bold uppercase tracking-tight text-brand-heading">
            Docsy
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-6 md:flex">
          <Link
            href="/products"
            className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading transition-colors hover:text-brand-cta"
          >
            All products
          </Link>
          {categories.slice(0, 4).map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className="font-heading text-sm font-bold uppercase tracking-wide text-brand-body transition-colors hover:text-brand-cta"
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <form action="/search" method="get" className="ml-auto flex items-center md:ml-0">
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="site-search"
              type="search"
              name="q"
              placeholder="Search"
              className="h-10 w-36 rounded-full border border-input bg-white pl-9 pr-3 text-sm text-brand-body placeholder:text-muted-foreground focus-visible:border-brand-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta/30 sm:w-56"
            />
          </div>
        </form>
      </div>

      <nav className="flex gap-4 overflow-x-auto border-t border-border/70 px-4 py-2 no-scrollbar md:hidden">
        <Link
          href="/products"
          className="shrink-0 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading"
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${c.slug}`}
            className="shrink-0 font-heading text-xs font-bold uppercase tracking-wide text-brand-body"
          >
            {c.name}
          </Link>
        ))}
      </nav>
    </header>
  )
}
