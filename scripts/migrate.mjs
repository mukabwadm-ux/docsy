/**
 * Applies supabase/migrations/*.sql in filename order.
 *
 * Each file runs inside a transaction and is recorded in _docsy_migrations, so
 * re-running is a no-op. Pass --force to re-apply everything (the SQL is
 * written to be idempotent).
 *
 *   node scripts/migrate.mjs [--force]
 *
 * Uses DIRECT_URL — the session pooler. The transaction pooler on 6543 cannot
 * run this: DDL and multi-statement transactions need a session-scoped
 * connection.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import pg from 'pg'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })
const dir = join(root, 'supabase', 'migrations')
const force = process.argv.includes('--force')

const connectionString = process.env.DIRECT_URL
if (!connectionString) {
  console.error('DIRECT_URL is not set (check .env.local)')
  process.exit(1)
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  statement_timeout: 120000,
})

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12)

await client.connect()
await client.query(`
  create table if not exists _docsy_migrations (
    name text primary key,
    checksum text not null,
    applied_at timestamptz default now()
  )`)

const applied = new Map(
  (await client.query('select name, checksum from _docsy_migrations')).rows.map((r) => [
    r.name,
    r.checksum,
  ])
)

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
let ran = 0

for (const file of files) {
  const sql = readFileSync(join(dir, file), 'utf8')
  const checksum = sha(sql)
  const prev = applied.get(file)

  if (prev === checksum && !force) {
    console.log(`  skip  ${file}`)
    continue
  }
  if (prev && prev !== checksum) {
    console.log(`  CHANGED ${file} — re-applying`)
  }

  process.stdout.write(`  apply ${file} ... `)
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query(
      `insert into _docsy_migrations (name, checksum) values ($1, $2)
       on conflict (name) do update set checksum = excluded.checksum, applied_at = now()`,
      [file, checksum]
    )
    await client.query('commit')
    console.log('ok')
    ran++
  } catch (err) {
    await client.query('rollback')
    console.log('FAILED')
    console.error(`\n${file}: ${err.message}`)
    if (err.position) {
      const upto = sql.slice(0, Number(err.position))
      console.error(`  at line ${upto.split('\n').length}`)
    }
    await client.end()
    process.exit(1)
  }
}

await client.end()
console.log(`\n${ran} migration(s) applied, ${files.length - ran} up to date.`)
