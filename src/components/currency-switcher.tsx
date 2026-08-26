'use client'

import { useEffect, useState } from 'react'
import { CURRENCY_COOKIE, type Currency } from '@/lib/currency'
import { cn } from '@/lib/utils'

/**
 * Lets a visitor override the currency geography picked for them.
 *
 * Worth having even though detection is usually right: a Kenyan paying with an
 * international card, or someone travelling, otherwise has no way to see the
 * price they will actually be charged in. Their choice wins over geo from then
 * on, because middleware only sets the cookie when it is absent.
 *
 * Switching sets the attribute immediately — the prices are already in the DOM in
 * both currencies, so there is nothing to re-fetch and nothing to wait for.
 */
export function CurrencySwitcher({ className }: { className?: string }) {
  const [currency, setCurrency] = useState<Currency>('USD')

  // Read after mount rather than during render: the server has no idea which
  // currency this visitor has, and guessing would produce a hydration mismatch.
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )docsy_currency=([^;]*)/)
    const value = match ? decodeURIComponent(match[1]).toUpperCase() : 'USD'
    setCurrency(value === 'KES' ? 'KES' : 'USD')
  }, [])

  function choose(next: Currency) {
    setCurrency(next)
    document.documentElement.setAttribute('data-currency', next)
    if (next === 'USD') document.documentElement.removeAttribute('data-currency')
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  }

  return (
    <div
      className={cn('inline-flex overflow-hidden rounded-full border border-border', className)}
      role="group"
      aria-label="Display currency"
    >
      {(['USD', 'KES'] as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => choose(c)}
          aria-pressed={currency === c}
          className={cn(
            'px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-wider transition-colors',
            currency === c
              ? 'bg-brand-heading text-white'
              : 'bg-white text-brand-body hover:text-brand-cta'
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
