import { convert, formatMoney, type Currency, type StoreRates } from '@/lib/currency'
import { cn } from '@/lib/utils'

/**
 * A price in both currencies, with the wrong one hidden by CSS.
 *
 * Both are rendered server-side and the visitor's choice is applied by a
 * data-currency attribute set on <html> before paint. That is what lets the
 * catalog and product pages stay statically generated: reading a cookie during
 * render would make every page dynamic, and rendering one price then swapping it
 * on the client would show the wrong number first.
 *
 * The trade is a few bytes of markup per price. Worth it — the alternative costs
 * either the static build or a visible price flicker.
 */
export function Price({
  usd,
  rates,
  className,
  strike = false,
}: {
  usd: number
  rates: StoreRates
  className?: string
  /** Struck-through compare-at price. */
  strike?: boolean
}) {
  const usdText = formatMoney(usd, 'USD')
  const kesText = formatMoney(convert(usd, 'KES', rates), 'KES')

  return (
    <span className={cn(strike && 'line-through', className)}>
      <span data-price="USD">{usdText}</span>
      <span data-price="KES">{kesText}</span>
    </span>
  )
}

/** The same value, resolved on the server when the currency is already known. */
export function formatFor(usd: number, currency: Currency, rates: StoreRates) {
  return formatMoney(convert(usd, currency, rates), currency)
}
