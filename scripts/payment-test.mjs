/**
 * Exercises the payment path without touching Paystack.
 *
 *   node scripts/payment-test.mjs
 *
 * Expects the Next server running on :3000 with PAYSTACK_SECRET_KEY set to a
 * throwaway value — the webhook only needs the key to check its own HMAC, so the
 * signature path, the idempotency guard and the paid/delivered transition can all
 * be verified for real without a Paystack account.
 *
 * Cleans up after itself.
 */
import crypto from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_docsy_local_only'
const WEBHOOK = 'http://localhost:3000/api/webhooks/paystack'
const EMAIL = 'paytest@example.com'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

const pass = (m) => console.log(`  PASS  ${m}`)
const fail = (m) => {
  console.log(`  FAIL  ${m}`)
  process.exitCode = 1
}

const sign = (body) => crypto.createHmac('sha512', SECRET).update(body, 'utf8').digest('hex')

async function post(body, signature) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'x-paystack-signature': signature } : {}),
    },
    body,
  })
  return { status: res.status, text: await res.text() }
}

// -------------------------------------------------------------- clean slate
await db.from('manual_orders').delete().eq('buyer_email', EMAIL)

const { data: product } = await db
  .from('products')
  .select('id, price, currency')
  .eq('slug', '90-day-content-calendar')
  .single()

const REFERENCE = `DCS-TEST-${Date.now().toString(36).toUpperCase()}`

const { data: order } = await db
  .from('manual_orders')
  .insert({
    product_id: product.id,
    buyer_email: EMAIL,
    buyer_name: 'Pay Test',
    amount: 3750,
    base_amount: 29,
    fx_rate: 129,
    currency: 'KES',
    status: 'pending',
    payment_provider: 'paystack',
    payment_reference: REFERENCE,
    payment_status: 'pending',
    checkout_token: crypto.randomBytes(24).toString('hex'),
    checkout_expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  .select('id')
  .single()

console.log(`test order ${order.id.slice(0, 8)}… reference ${REFERENCE}\n`)

const chargeBody = JSON.stringify({
  event: 'charge.success',
  data: {
    reference: REFERENCE,
    amount: 375000, // 3,750.00 KES in cents
    currency: 'KES',
    status: 'success',
  },
})

// ------------------------------------------------ 1. forged signatures rejected
const noSig = await post(chargeBody, null)
noSig.status === 401 ? pass('unsigned webhook rejected (401)') : fail(`unsigned got ${noSig.status}`)

const badSig = await post(chargeBody, 'f'.repeat(128))
badSig.status === 401 ? pass('wrong signature rejected (401)') : fail(`bad signature got ${badSig.status}`)

const shortSig = await post(chargeBody, 'abc')
shortSig.status === 401
  ? pass('short signature rejected without a length crash')
  : fail(`short signature got ${shortSig.status}`)

// A signature valid for *different* content must not authorise this one.
const wrongBodySig = sign(JSON.stringify({ event: 'charge.success', data: { reference: 'OTHER' } }))
const mismatched = await post(chargeBody, wrongBodySig)
mismatched.status === 401
  ? pass("a signature from another payload is rejected")
  : fail(`mismatched body signature got ${mismatched.status}`)

let stillUnpaid = await db
  .from('manual_orders')
  .select('payment_status, status')
  .eq('id', order.id)
  .single()
stillUnpaid.data.payment_status === 'pending'
  ? pass('no forged attempt changed the order')
  : fail(`order state moved to ${stillUnpaid.data.payment_status}`)

// ------------------------------------------------- 2. a genuine charge settles
const good = await post(chargeBody, sign(chargeBody))
good.status === 200 ? pass('correctly signed webhook accepted (200)') : fail(`signed got ${good.status}`)

const first = JSON.parse(good.text)
first.transitioned ? pass('first delivery made the paid transition') : fail('did not transition')

const afterPaid = await db
  .from('manual_orders')
  .select('payment_status, paid_at, amount, currency, base_amount, status, payment_meta')
  .eq('id', order.id)
  .single()

afterPaid.data.payment_status === 'paid' ? pass('order recorded as paid') : fail('not marked paid')
afterPaid.data.paid_at ? pass('paid_at stamped') : fail('paid_at missing')
Number(afterPaid.data.amount) === 3750
  ? pass('amount taken from the gateway in major units (3750 KES, not 375000)')
  : fail(`amount is ${afterPaid.data.amount}`)
Number(afterPaid.data.base_amount) === 29
  ? pass('USD base preserved for revenue (29.00)')
  : fail(`base_amount is ${afterPaid.data.base_amount}`)
afterPaid.data.payment_meta ? pass('gateway payload kept for reconciliation') : fail('no payment_meta')

// ------------------------------------------------------- 3. retries are safe
const replay = await post(chargeBody, sign(chargeBody))
const second = JSON.parse(replay.text)
replay.status === 200 ? pass('replayed webhook still answers 200') : fail(`replay got ${replay.status}`)
second.transitioned === false
  ? pass('replay did NOT transition again — no double delivery')
  : fail('replay transitioned a second time')

// Three at once, as a retry storm would.
const storm = await Promise.all([
  post(chargeBody, sign(chargeBody)),
  post(chargeBody, sign(chargeBody)),
  post(chargeBody, sign(chargeBody)),
])
const transitions = storm.map((r) => JSON.parse(r.text).transitioned).filter(Boolean).length
transitions === 0
  ? pass('three concurrent replays transitioned nobody')
  : fail(`${transitions} concurrent replays transitioned`)

// ------------------------------------------------- 4. unrelated events ignored
const other = JSON.stringify({ event: 'transfer.success', data: { reference: REFERENCE } })
const otherRes = await post(other, sign(other))
otherRes.status === 200 && JSON.parse(otherRes.text).ignored === 'transfer.success'
  ? pass('unrelated event acknowledged and ignored')
  : fail(`unrelated event: ${otherRes.status} ${otherRes.text}`)

// An unknown reference must not create anything.
const ghost = JSON.stringify({
  event: 'charge.success',
  data: { reference: 'DCS-DOES-NOT-EXIST', amount: 100, currency: 'KES', status: 'success' },
})
const ghostRes = await post(ghost, sign(ghost))
const { count: total } = await db
  .from('manual_orders')
  .select('id', { count: 'exact', head: true })
  .eq('buyer_email', EMAIL)
ghostRes.status === 200 && total === 1
  ? pass('a charge for an unknown reference creates no order')
  : fail(`ghost charge left ${total} orders`)

// ---------------------------------------------------------------- cleanup
await db.from('manual_orders').delete().eq('buyer_email', EMAIL)
console.log('\ncleaned up the test order')
