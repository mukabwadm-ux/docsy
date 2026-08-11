import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Windowed page list: first, last, and a couple either side of the current
 * page, with ellipses for the gaps. A catalog of 40 pages should not render 40
 * links on a phone.
 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const out: (number | 'gap')[] = [1]
  const from = Math.max(2, current - 1)
  const to = Math.min(total - 1, current + 1)

  if (from > 2) out.push('gap')
  for (let p = from; p <= to; p++) out.push(p)
  if (to < total - 1) out.push('gap')
  out.push(total)

  return out
}

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      <PageLink href={buildHref(page - 1)} disabled={page <= 1} label="Previous page">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </PageLink>

      {pageWindow(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-brand-body/50" aria-hidden>
            …
          </span>
        ) : (
          <PageLink key={p} href={buildHref(p)} active={p === page} label={`Page ${p}`}>
            {p}
          </PageLink>
        )
      )}

      <PageLink href={buildHref(page + 1)} disabled={page >= totalPages} label="Next page">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </PageLink>
    </nav>
  )
}

function PageLink({
  href,
  children,
  active = false,
  disabled = false,
  label,
}: {
  href: string
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  label: string
}) {
  const classes = cn(
    'inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 font-heading text-sm font-bold transition-colors',
    active
      ? 'border-brand-cta bg-brand-cta text-white'
      : 'border-border bg-white text-brand-heading hover:border-brand-cta hover:text-brand-cta',
    disabled && 'pointer-events-none opacity-40'
  )

  // A disabled arrow must not be a link at all — an <a> without href is still
  // focusable in some browsers and announces as a broken link.
  if (disabled) {
    return (
      <span className={classes} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    )
  }

  return (
    <Link href={href} scroll={false} className={classes} aria-label={label} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}
