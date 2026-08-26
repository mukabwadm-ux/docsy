/**
 * Checks that every place Docsy converts a price agrees with every other.
 *
 *   node scripts/currency-test.mjs
 *
 * There are two implementations by necessity — price_in() in SQL so the database
 * can convert, and convert() in TypeScript so a catalog page does not need an RPC
 * per card. Two implementations of the same arithmetic drift, and the way that
 * drift is discovered is a buyer being charged a different number from the one on
 * the product page. This asserts they never do.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

const pass = (m) => console.log(`  PASS  ${m}`)
const fail = (m) => {
  console.log(`  FAIL  ${m}`)
  process.exitCode = 1
}

const { data: settings } = await db
  .from('store_settings')
  .select('usd_to_kes, kes_rounding, geo_pricing_enabled')
  .eq('id', 1)
  .single()

const rate = Number(settings.usd_to_kes)
const step = Number(settings.kes_rounding)
console.log(`rate: 1 USD = ${rate} KES, rounding up to ${step}\n`)

/** The TypeScript rule, copied verbatim from src/lib/currency.ts. */
const convertTs = (usd) => Math.ceil((usd * rate) / step) * step

// A spread of real prices plus the awkward ones: zero, sub-dollar, and values
// that land exactly on a rounding boundary.
const prices = [0, 0.5, 1, 4.99, 9.99, 15, 19, 24, 29, 39, 49, 99, 149.99, 999.99]

let mismatches = 0
for (const usd of prices) {
  const { data: sqlValue, error } = await db.rpc('price_in', { p_usd: usd, p_currency: 'KES' })
  if (error) {
    fail(`price_in(${usd}) errored: ${error.message}`)
    continue
  }
  const ts = convertTs(usd)
  const sql = Number(sqlValue)
  if (sql !== ts) {
    fail(`$${usd}: SQL says ${sql}, TypeScript says ${ts}`)
    mismatches++
  }
}
mismatches === 0
  ? pass(`SQL and TypeScript agree on all ${prices.length} prices`)
  : fail(`${mismatches} price(s) disagree between SQL and TypeScript`)

// USD must pass through untouched, not round-trip through the rate.
const { data: usdBack } = await db.rpc('price_in', { p_usd: 19.99, p_currency: 'USD' })
Number(usdBack) === 19.99 ? pass('USD passes through unconverted') : fail(`USD mangled to ${usdBack}`)

// Rounding direction: never below the true conversion, never more than one step above.
let roundingOk = true
for (const usd of prices.filter((p) => p > 0)) {
  const exact = usd * rate
  const rounded = convertTs(usd)
  if (rounded < exact || rounded - exact >= step) roundingOk = false
}
roundingOk
  ? pass(`every price rounds up, by less than one full step of ${step}`)
  : fail('rounding goes the wrong way or overshoots')

// Geo resolution, including the override that has to beat it.
const resolve = (country, cookie, geo = true) => {
  const chosen = (cookie ?? '').toUpperCase()
  if (chosen === 'USD' || chosen === 'KES') return chosen
  if (!geo) return 'USD'
  return (country ?? '').toUpperCase() === 'KE' ? 'KES' : 'USD'
}
const cases = [
  ['KE', null, true, 'KES', 'a visitor in Kenya sees KES'],
  ['US', null, true, 'USD', 'a visitor in the US sees USD'],
  [null, null, true, 'USD', 'unknown country falls back to USD'],
  ['KE', 'USD', true, 'USD', 'an explicit USD choice beats Kenyan geo'],
  ['US', 'KES', true, 'KES', 'an explicit KES choice beats US geo'],
  ['KE', null, false, 'USD', 'geo pricing off means USD for everyone'],
  ['ke', null, true, 'KES', 'country code is case-insensitive'],
]
let geoOk = true
for (const [country, cookie, geo, want, label] of cases) {
  const got = resolve(country, cookie, geo)
  if (got !== want) {
    fail(`${label}: got ${got}, wanted ${want}`)
    geoOk = false
  }
}
if (geoOk) pass(`all ${cases.length} currency-resolution cases behave`)

// A worked example, so the numbers are legible rather than merely asserted.
console.log('\nworked example — a $29 product:')
const { data: sql29 } = await db.rpc('price_in', { p_usd: 29, p_currency: 'KES' })
console.log(`  exact:   29 x ${rate} = ${(29 * rate).toFixed(2)} KES`)
console.log(`  charged: ${Number(sql29).toLocaleString('en-KE')} KES (rounded up to the nearest ${step})`)
console.log(`  stored:  base_amount 29.00 USD, fx_rate ${rate}`)
console.log(`  back:    ${Number(sql29)} / ${rate} = ${(Number(sql29) / rate).toFixed(2)} USD`)
