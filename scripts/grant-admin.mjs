/**
 * Creates (or promotes) an admin user.
 *
 *   node scripts/grant-admin.mjs you@example.com 'a-strong-password'
 *
 * If the auth user already exists, the password argument is ignored and the
 * account is simply added to admin_users.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const [email, password] = process.argv.slice(2)
if (!email) {
  console.error('Usage: node scripts/grant-admin.mjs <email> [password]')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// listUsers is paginated; walk it rather than assuming the account is on page 1.
async function findUser(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

let user = await findUser(email)

if (!user) {
  if (!password) {
    console.error(`No account for ${email}. Pass a password to create one.`)
    process.exit(1)
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    // Confirmed immediately: there is no inbox flow for the shop owner, and an
    // unconfirmed account cannot sign in.
    email_confirm: true,
  })
  if (error) {
    console.error(`Could not create user: ${error.message}`)
    process.exit(1)
  }
  user = data.user
  console.log(`Created auth user ${email}`)
} else {
  console.log(`Found existing auth user ${email}`)
}

const { error } = await db
  .from('admin_users')
  .upsert({ id: user.id, email, role: 'owner' }, { onConflict: 'id' })

if (error) {
  console.error(`Could not grant admin: ${error.message}`)
  process.exit(1)
}

console.log(`\n${email} is now an admin. Sign in at /admin/login`)
