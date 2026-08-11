import Link from 'next/link'
import { FileText } from 'lucide-react'
import { SearchAutocomplete } from '@/components/search-autocomplete'
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

        <div className="ml-auto md:ml-0">
          <SearchAutocomplete variant="header" />
        </div>
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
