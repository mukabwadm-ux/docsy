import { publicDb } from './supabase/public'

export type Currency = 'USD' | 'KES'

export const CURRENCIES: Currency[] = ['USD', 'KES']

/** Countries that see KES. Only Kenya, per the brief. */
const KES_COUNTRIES = new Set(['KE'])

export const CURRENCY_COOKIE = 'docsy_currency'

export interface StoreRates {
  usdToKes: number
  kesRounding: number
  geoPricingEnabled: boolean
  rateUpdatedAt: string
}

const FALLBACK: StoreRates = {
  usdToKes: 129,
  kesRounding: 10,
  geoPricingEnabled: true,
  rateUpdatedAt: new Date(0).toISOString(),
}

/**
 * The shop's published rate.
 *
 * Read through the cached public client, so a catalog page renders prices without
 * a per-request round trip. A stale-by-a-minute rate is fine; the amount a buyer
 * is actually charged is recomputed and snapshotted server-side at checkout.
 */
export async function getRates(): Promise<StoreRates> {
  const { data } = await publicDb
    .from('store_settings')
    .select('usd_to_kes, kes_rounding, geo_pricing_enabled, rate_updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (!data) return FALLBACK

  const row = data as {
    usd_to_kes: number | string
    kes_rounding: number
    geo_pricing_enabled: boolean
    rate_updated_at: string
  }

  return {
    usdToKes: Number(row.usd_to_kes) || FALLBACK.usdToKes,
    kesRounding: Number(row.kes_rounding) || FALLBACK.kesRounding,
    geoPricingEnabled: row.geo_pricing_enabled ?? true,
    rateUpdatedAt: row.rate_updated_at,
  }
}

/**
 * Converts a USD price for display.
 *
 * Mirrors price_in() in migration 0010 exactly — same multiply, same ceil to the
 * rounding step. Two implementations is a risk, but the alternative is an RPC per
 * price on every card in the catalog. They are checked against each other in
 * scripts/currency-test.mjs so a drift is caught rather than discovered on a
 * receipt.
 */
export function convert(usd: number, currency: Currency, rates: StoreRates): number {
  if (currency === 'USD') return Math.round(usd * 100) / 100
  const raw = usd * rates.usdToKes
  return Math.ceil(raw / rates.kesRounding) * rates.kesRounding
}

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  // No decimals: shilling prices are quoted whole, and "KSh 2,460.00" reads as a
  // conversion artefact rather than a price.
  KES: new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
}

export function formatMoney(amount: number, currency: Currency): string {
  if (amount === 0) return 'Free'
  return FORMATTERS[currency].format(amount)
}

/** USD price straight to a formatted string in the target currency. */
export function formatUsdAs(usd: number, currency: Currency, rates: StoreRates): string {
  return formatMoney(convert(usd, currency, rates), currency)
}

/**
 * Which currency a request should see.
 *
 * An explicit choice always wins over geography. Geo detection is wrong often
 * enough — VPNs, travellers, corporate proxies — that overriding someone's stated
 * preference would be worse than not detecting at all.
 */
export function resolveCurrency(
  countryCode: string | null | undefined,
  cookieValue: string | null | undefined,
  geoEnabled = true
): Currency {
  const chosen = (cookieValue ?? '').toUpperCase()
  if (chosen === 'USD' || chosen === 'KES') return chosen
  if (!geoEnabled) return 'USD'
  return KES_COUNTRIES.has((countryCode ?? '').toUpperCase()) ? 'KES' : 'USD'
}
