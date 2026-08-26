/**
 * Checks the configuration store, in particular the parts that would be
 * expensive to get wrong.
 *
 *   node scripts/config-test.mjs
 *
 * Asserts that secrets are encrypted at rest, that a wrong key cannot read them,
 * that tampered ciphertext is rejected rather than silently decrypted to
 * something else, and that public config stays readable.
 */
import crypto from 'node:crypto'
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

// The same scheme as src/lib/secret-box.ts, so this exercises the real format.
const KEY = crypto.randomBytes(32)
const WRONG_KEY = crypto.randomBytes(32)

function encrypt(plaintext, key = KEY) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

function decrypt(stored, key = KEY) {
  const parts = stored.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

const SECRET = 'sk_live_pretend_paystack_key_9f3a'
const TEST_KEYS = ['paystack.secret_key', 'analytics.ga4_id']

await db.from('app_config').delete().in('key', TEST_KEYS)

// ------------------------------------------------ round trip and key isolation
const ciphertext = encrypt(SECRET)
decrypt(ciphertext) === SECRET ? pass('secret round-trips with the right key') : fail('round trip broke')
decrypt(ciphertext, WRONG_KEY) === null
  ? pass('a different key cannot read it')
  : fail('DECRYPTED WITH THE WRONG KEY')

// GCM authenticates: a flipped byte must fail, not yield different plaintext.
const parts = ciphertext.split('.')
const body = Buffer.from(parts[3], 'base64url')
body[0] = body[0] ^ 0xff
const tampered = [parts[0], parts[1], parts[2], body.toString('base64url')].join('.')
decrypt(tampered) === null
  ? pass('tampered ciphertext is rejected, not silently altered')
  : fail('TAMPERED CIPHERTEXT DECRYPTED')

const truncated = ciphertext.slice(0, -6)
decrypt(truncated) === null ? pass('truncated value rejected') : fail('truncated value decrypted')
decrypt('v2.a.b.c') === null ? pass('unknown version rejected') : fail('unknown version accepted')

// -------------------------------------- what actually lands in the database
await db.from('app_config').insert([
  { key: 'paystack.secret_key', value: ciphertext, is_secret: true },
  { key: 'analytics.ga4_id', value: 'G-TESTDOCSY1', is_secret: false },
])

const { data: rows } = await db.from('app_config').select('key, value, is_secret').in('key', TEST_KEYS)
const secretRow = rows.find((r) => r.key === 'paystack.secret_key')
const publicRow = rows.find((r) => r.key === 'analytics.ga4_id')

!secretRow.value.includes(SECRET)
  ? pass('the plaintext secret is nowhere in the stored row')
  : fail('PLAINTEXT SECRET IS IN THE DATABASE')
secretRow.value.startsWith('v1.')
  ? pass('stored as versioned ciphertext')
  : fail(`unexpected stored format: ${secretRow.value.slice(0, 12)}`)
secretRow.is_secret === true ? pass('flagged as a secret') : fail('not flagged as secret')
publicRow.value === 'G-TESTDOCSY1'
  ? pass('public config stored in the clear, as intended')
  : fail('public config mangled')

// ------------------------------------------------------- anon has no access
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } }
)
const { data: leaked, error: anonErr } = await anon.from('app_config').select('key, value')
anonErr || !leaked?.length
  ? pass(`the publishable key cannot read app_config (${anonErr?.code ?? 'empty'})`)
  : fail(`ANON READ ${leaked.length} CONFIG ROWS`)

// Not even the non-secret rows, since ciphertext is only worth having while
// nobody can collect it at leisure.
const { error: anonWrite } = await anon
  .from('app_config')
  .insert({ key: 'analytics.ga4_id', value: 'G-HACKED' })
anonWrite ? pass('the publishable key cannot write app_config') : fail('ANON WROTE CONFIG')

// ------------------------------------------------------------ env precedence
const resolve = (envValue, dbValue) => (envValue?.trim() ? envValue.trim() : dbValue)
resolve('sk_from_env', 'sk_from_db') === 'sk_from_env'
  ? pass('environment wins over the database')
  : fail('database overrode the environment')
resolve(undefined, 'sk_from_db') === 'sk_from_db'
  ? pass('database is used when the environment is unset')
  : fail('database value ignored')
resolve('   ', 'sk_from_db') === 'sk_from_db'
  ? pass('a blank environment variable does not shadow the database')
  : fail('blank env value shadowed the database')

// ------------------------------------------------------------------- masking
const mask = (v) => (v.length <= 8 ? '••••••••' : `${v.slice(0, 7)}${'•'.repeat(12)}${v.slice(-4)}`)
const masked = mask(SECRET)
!masked.includes(SECRET.slice(8, -4)) && masked.startsWith('sk_live')
  ? pass(`mask shows the mode but not the key (${masked})`)
  : fail(`mask leaks too much: ${masked}`)

await db.from('app_config').delete().in('key', TEST_KEYS)
console.log('\ncleaned up test config rows')
