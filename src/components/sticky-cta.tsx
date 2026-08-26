'use client'

import { useEffect, useState } from 'react'
import { convert, formatMoney, type StoreRates } from '@/lib/currency'
import { cn } from '@/lib/utils'

/**
 * Mobile-only sticky buy bar.
 *
 * Hidden until the hero CTA has scrolled out of view, so it never sits on top of
 * the button it duplicates. It appears by watching the hero with an
 * IntersectionObserver rather than a scroll-offset threshold — the hero's height
 * varies with title length and benefit count, so any fixed pixel value would be
 * wrong on most products.
 */
export function StickyCta({
  price,
  rates,
  targetId,
  watchId,
}: {
  price: number
  rates: StoreRates
  /** Element the button scrolls to — the real buy panel. */
  targetId: string
  /** Element whose visibility suppresses the bar. */
  watchId: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById(watchId)
    if (!hero) return

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [watchId])

  function goToBuy() {
    const target = document.getElementById(targetId)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Nudge focus so a keyboard or screen-reader user lands where the tap went.
    target.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true })
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-brand-tan bg-white/95 px-4 py-3 backdrop-blur transition-transform duration-200 md:hidden',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
      // Keep it out of the tab order and off the a11y tree while off-screen.
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="font-heading text-xl font-bold leading-none text-brand-heading">
            <span data-price="USD">{formatMoney(price, 'USD')}</span>
            <span data-price="KES">{formatMoney(convert(price, 'KES', rates), 'KES')}</span>
          </p>
          <p className="mt-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body/70">
            Instant download
          </p>
        </div>
        <button
          type="button"
          onClick={goToBuy}
          tabIndex={visible ? 0 : -1}
          className="ml-auto h-12 flex-1 rounded-md bg-brand-cta font-heading text-sm font-bold uppercase tracking-wide text-white shadow-cta transition-colors hover:bg-brand-accent"
        >
          Get instant access →
        </button>
      </div>
    </div>
  )
}
