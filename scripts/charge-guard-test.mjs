/**
 * Exercises the underpayment guard against the real database.
 *
 *   npm run guard:test
 *
 * Creates throwaway orders, calls mark_order_paid the way a webhook would, and
 * checks each outcome. Every row it makes is deleted again, including on failure.
 *
 * The case that matters is the underpayment: before this guard, a charge of any
 * size at all marked an order paid and released the file.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

let passed = 0
let failed = 0
const made = []

const pass = (m) => {
  console.log(`  PASS  ${m}`)
  passed++
}
const fail = (m) => {
  console.log(`  FAIL  ${m}`)
  failed++
}

async function makeOrder({ amount, currency, chargeAmount, chargeCurrency }) {
  const reference = `TEST-GUARD-${Math.floor(performance.now() * 1000)}-${made.length}`
  const { data, error } = await db
    .from('manual_orders')
    .insert({
      buyer_email: 'guard-test@example.invalid',
      amount,
      currency,
      charge_amount: chargeAmount,
      charge_currency: chargeCurrency,
      payment_reference: reference,
      payment_status: 'pending',
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw new Error(`could not create test order: ${error.message}`)
  made.push(data.id)
  return reference
}

async function markPaid(reference, amount, currency) {
  const { data, error } = await db.rpc('mark_order_paid', {
    p_reference: reference,
    p_amount: amount,
    p_currency: currency,
    p_meta: { source: 'guard-test' },
  })
  if (error) throw new Error(`rpc failed: ${error.message}`)
  return data
}

async function statusOf(reference) {
  const { data } = await db
    .from('manual_orders')
    .select('payment_status, amount, currency, payment_meta')
    .eq('payment_reference', reference)
    .maybeSingle()
  return data
}

try {
  console.log('\nUnderpayment')
  {
    const ref = await makeOrder({
      amount: 16,
      currency: 'USD',
      chargeAmount: 2070,
      chargeCurrency: 'KES',
    })
    const outcome = await markPaid(ref, 5, 'KES')
    outcome === 'mismatch'
      ? pass('KES 5 against a KES 2,070 order is refused')
      : fail(`expected 'mismatch', got '${outcome}'`)

    const row = await statusOf(ref)
    row?.payment_status === 'mismatch'
      ? pass("order is left as 'mismatch', not 'paid'")
      : fail(`payment_status is '${row?.payment_status}'`)

    Number(row?.amount) === 16
      ? pass('the order amount was NOT overwritten with the underpaid figure')
      : fail(`amount became ${row?.amount}`)

    row?.payment_meta?.mismatch?.expected_amount
      ? pass('the discrepancy is recorded for review')
      : fail('no mismatch detail written to payment_meta')
  }

  console.log('\nCorrect payment')
  {
    const ref = await makeOrder({
      amount: 2070,
      currency: 'KES',
      chargeAmount: 2070,
      chargeCurrency: 'KES',
    })
    const outcome = await markPaid(ref, 2070, 'KES')
    outcome === 'paid' ? pass('the exact amount is accepted') : fail(`got '${outcome}'`)

    const again = await markPaid(ref, 2070, 'KES')
    again === 'already_paid'
      ? pass('a duplicate webhook is reported as already_paid, not paid twice')
      : fail(`second call returned '${again}'`)
  }

  console.log('\nRounding and overpayment')
  {
    const a = await makeOrder({ amount: 100, currency: 'KES', chargeAmount: 100, chargeCurrency: 'KES' })
    const outA = await markPaid(a, 99.995, 'KES')
    outA === 'paid'
      ? pass('a sub-cent rounding difference still settles')
      : fail(`rounding case returned '${outA}'`)

    const b = await makeOrder({ amount: 100, currency: 'KES', chargeAmount: 100, chargeCurrency: 'KES' })
    const outB = await markPaid(b, 150, 'KES')
    outB === 'paid'
      ? pass('an overpayment settles rather than withholding the file')
      : fail(`overpayment returned '${outB}'`)
  }

  console.log('\nWrong currency')
  {
    const ref = await makeOrder({
      amount: 16,
      currency: 'USD',
      chargeAmount: 2070,
      chargeCurrency: 'KES',
    })
    const outcome = await markPaid(ref, 2070, 'USD')
    outcome === 'mismatch'
      ? pass('USD 2,070 against a KES 2,070 charge is refused')
      : fail(`expected 'mismatch', got '${outcome}'`)
  }

  console.log('\nLegacy orders (no charge_amount recorded)')
  {
    const ref = await makeOrder({
      amount: 500,
      currency: 'KES',
      chargeAmount: null,
      chargeCurrency: null,
    })
    const under = await markPaid(ref, 10, 'KES')
    under === 'mismatch'
      ? pass('falls back to the order amount, so old orders are guarded too')
      : fail(`expected 'mismatch', got '${under}'`)
  }

  console.log('\nUnknown reference')
  {
    const outcome = await markPaid('TEST-GUARD-does-not-exist', 100, 'KES')
    outcome === 'not_found'
      ? pass('an unrecognised reference is reported, not silently ignored')
      : fail(`expected 'not_found', got '${outcome}'`)
  }
} catch (err) {
  fail(err.message)
} finally {
  if (made.length) {
    const { error } = await db.from('manual_orders').delete().in('id', made)
    console.log(
      error ? `\n  WARNING: could not clean up ${made.length} test orders: ${error.message}`
            : `\ncleaned up ${made.length} test orders`
    )
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
