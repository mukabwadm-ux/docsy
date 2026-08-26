'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileText, FolderTree, Loader2, Search } from 'lucide-react'
import { fileTypeLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Suggestion {
  id: string
  title: string
  slug: string
  price: number
  currency: string
  file_type: string | null
  preview_image_url: string | null
  rating_avg: number
  rating_count: number
  priceUsd: string
  priceKes: string
}

interface CategoryHit {
  id: string
  name: string
  slug: string
}

const DEBOUNCE_MS = 180
const MIN_LENGTH = 2
/**
 * How long a zero-result query must sit untouched before it counts as a dead
 * end worth recording. Long enough that it is not simply mid-word.
 */
const ABANDON_MS = 2000

/**
 * Search box with live suggestions.
 *
 * Still a real <form action="/search"> underneath. With JavaScript unavailable —
 * or before this component hydrates — typing and pressing Enter goes to the
 * search page exactly as before, so the suggestions are an enhancement rather
 * than the only way to search.
 */
export function SearchAutocomplete({
  variant = 'header',
  defaultValue = '',
  autoFocus = false,
  placeholder,
}: {
  variant?: 'header' | 'hero'
  defaultValue?: string
  autoFocus?: boolean
  placeholder?: string
}) {
  const router = useRouter()
  const listId = useId()

  const [query, setQuery] = useState(defaultValue)
  const [items, setItems] = useState<Suggestion[]>([])
  const [cats, setCats] = useState<CategoryHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  /** Distinguishes "no results yet" from "searched, found nothing". */
  const [searched, setSearched] = useState(false)

  const wrapper = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  /**
   * The query the newest request was issued for. Responses can arrive out of
   * order — a slow request for "tem" landing after a fast one for "template"
   * would repaint the list with results for text the visitor has already moved
   * past. Aborting handles most of it; this check handles the rest.
   */
  const latest = useRef('')

  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < MIN_LENGTH) {
      abort.current?.abort()
      setItems([])
      setCats([])
      setLoading(false)
      setSearched(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      latest.current = trimmed

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as {
          query: string
          products: Suggestion[]
          categories: CategoryHit[]
        }

        if (latest.current !== trimmed) return
        setItems(data.products ?? [])
        setCats(data.categories ?? [])
        setSearched(true)
        setActive(-1)
      } catch {
        // An aborted request is the normal case here, not a failure.
        if (latest.current === trimmed) {
          setItems([])
          setCats([])
        }
      } finally {
        if (latest.current === trimmed) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  /**
   * Report a query that found nothing and was then left alone.
   *
   * This is the signal worth having: somebody wanted a thing, we did not have
   * it, and they gave up without pressing Enter — so it never reaches the
   * /search page where committed searches are logged. Guarded on `searched` so
   * a query still in flight is never reported as empty.
   */
  useEffect(() => {
    const trimmed = query.trim()
    if (!searched || loading || trimmed.length < 3) return
    if (items.length > 0 || cats.length > 0) return

    const timer = setTimeout(() => {
      // keepalive so the report still goes out if the visitor navigates away,
      // which is the most likely thing to happen next after finding nothing.
      void fetch('/api/search/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: trimmed }),
        keepalive: true,
      }).catch(() => undefined)
    }, ABANDON_MS)

    return () => clearTimeout(timer)
  }, [query, searched, loading, items.length, cats.length])

  // Close when focus or the pointer leaves the component entirely.
  useEffect(() => {
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  function go(slug: string) {
    setOpen(false)
    router.push(`/products/${slug}`)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || items.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      // Only intercept Enter when something is highlighted; otherwise let the
      // form submit through to the full results page.
      e.preventDefault()
      go(items[active].slug)
    }
  }

  const showPanel = open && query.trim().length >= MIN_LENGTH
  const isHero = variant === 'hero'

  return (
    <div ref={wrapper} className={cn('relative', isHero ? 'w-full max-w-lg' : 'w-full')}>
      <form action="/search" method="get" className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor={`${listId}-input`} className="sr-only">
            Search products
          </label>
          <Search
            className={cn(
              'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
              isHero ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4'
            )}
            aria-hidden
          />
          <input
            ref={inputRef}
            id={`${listId}-input`}
            type="search"
            name="q"
            value={query}
            autoFocus={autoFocus}
            autoComplete="off"
            placeholder={placeholder ?? (isHero ? 'Search templates, ebooks and guides' : 'Search')}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
            className={cn(
              'w-full border border-input bg-white text-brand-body placeholder:text-muted-foreground focus-visible:border-brand-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta/30',
              isHero
                ? 'h-14 rounded-md pl-12 pr-10 text-[15px]'
                : 'h-10 rounded-full pl-9 pr-9 text-sm sm:w-56'
            )}
          />
          {loading && (
            <Loader2
              className={cn(
                'absolute top-1/2 -translate-y-1/2 animate-spin text-brand-cta',
                isHero ? 'right-4 h-4 w-4' : 'right-3 h-3.5 w-3.5'
              )}
              aria-hidden
            />
          )}
        </div>

        {isHero && (
          <button
            type="submit"
            className="h-14 shrink-0 rounded-md bg-brand-cta px-7 font-heading text-base font-bold uppercase tracking-wide text-white shadow-cta transition-colors hover:bg-brand-accent"
          >
            Search
          </button>
        )}
      </form>

      {showPanel && (
        <div
          className={cn(
            'absolute z-50 mt-2 overflow-hidden rounded-lg border border-border bg-white shadow-card-hover',
            isHero ? 'left-0 right-0' : 'right-0 w-80'
          )}
        >
          {cats.length > 0 && (
            <ul className="border-b border-border" aria-label="Matching categories">
              {cats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setOpen(false)
                      router.push(`/products?category=${c.slug}`)
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-brand-cream/60"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-cream text-brand-cta">
                      <FolderTree className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-brand-heading">
                      Browse all <span className="font-medium">{c.name}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-body/50" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ul id={listId} role="listbox" aria-label="Search suggestions">
            {items.map((item, i) => (
              <li key={item.id} role="none">
                <button
                  type="button"
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // Mouse down beats click here: click fires after blur, and the
                  // blur would already have closed the panel.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    go(item.slug)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    i === active ? 'bg-brand-cream' : 'bg-white hover:bg-brand-cream/60'
                  )}
                >
                  <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded border border-border bg-brand-cream">
                    {item.preview_image_url ? (
                      <Image
                        src={item.preview_image_url}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <FileText className="h-4 w-4 text-brand-tan" aria-hidden />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-brand-heading">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/70">
                      {fileTypeLabel(item.file_type)}
                      {item.rating_count > 0 && ` · ${item.rating_avg.toFixed(1)}★`}
                    </span>
                  </span>

                  <span className="shrink-0 font-heading text-sm font-bold text-brand-heading">
                    <span data-price="USD">{item.priceUsd}</span>
                    <span data-price="KES">{item.priceKes}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {items.length === 0 && cats.length === 0 && searched && !loading && (
            <p className="px-3 py-4 text-sm text-brand-body">
              Nothing matched “{query.trim()}”.
            </p>
          )}

          {items.length === 0 && cats.length === 0 && loading && (
            <p className="px-3 py-4 text-sm text-brand-body/70">Searching…</p>
          )}

          {/* Always offer the full page: the dropdown shows at most six. */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setOpen(false)
              router.push(`/search?q=${encodeURIComponent(query.trim())}`)
            }}
            className="flex w-full items-center justify-between gap-2 border-t border-border bg-brand-cream/40 px-3 py-2.5 text-left font-heading text-[11px] font-bold uppercase tracking-wider text-brand-cta hover:bg-brand-cream"
          >
            See all results for “{query.trim()}”
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
