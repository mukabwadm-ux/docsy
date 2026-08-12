/**
 * Exercises the campaign engine through the running app.
 *
 * Expects, already running:
 *   - the Next server on :3000, started with SMTP_HOST/PORT/USER/PASS + EMAIL_FROM
 *     pointed at 127.0.0.1:2526
 *   - headless Chrome with --remote-debugging-port=9222
 *
 * This script stands up the SMTP server those env vars point at, seeds a known
 * audience, drives the admin UI to send, and asserts on what actually left the
 * app. Driving the UI rather than importing the engine means the real server
 * actions, the real queue and the real templates are all under test.
 *
 * Cleans up after itself. Safe to re-run.
 */
import net from 'node:net'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const CRLF = '\r\n'
const SMTP_PORT = 2526
const PREFIX = 'camptest-'
const ADMIN = { email: 'mukabwa.dm@gmail.com', password: 'Cashy@2020#' }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

const pass = (m) => console.log(`  PASS  ${m}`)
const fail = (m) => {
  console.log(`  FAIL  ${m}`)
  process.exitCode = 1
}

// -------------------------------------------------------- fake SMTP server
function startServer() {
  const messages = []
  const server = net.createServer((socket) => {
    let inData = false
    let buffer = ''
    let to = []
    socket.write(`220 localhost ready${CRLF}`)
    socket.on('data', (chunk) => {
      const text = chunk.toString()
      if (inData) {
        buffer += text
        if (buffer.includes(`${CRLF}.${CRLF}`)) {
          inData = false
          messages.push({ to: to.slice(), raw: buffer })
          buffer = ''
          to = []
          socket.write(`250 Ok queued${CRLF}`)
        }
        return
      }
      for (const line of text.split(CRLF).filter(Boolean)) {
        const cmd = line.toUpperCase()
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
          socket.write(`250-localhost${CRLF}250 AUTH PLAIN LOGIN${CRLF}`)
        } else if (cmd.startsWith('AUTH')) socket.write(`235 Ok${CRLF}`)
        else if (cmd.startsWith('RCPT TO')) {
          to.push(line.slice(line.indexOf(':') + 1).trim().replace(/[<>]/g, ''))
          socket.write(`250 Ok${CRLF}`)
        } else if (cmd.startsWith('DATA')) {
          inData = true
          socket.write(`354 Go ahead${CRLF}`)
        } else if (cmd.startsWith('QUIT')) {
          socket.write(`221 Bye${CRLF}`)
          socket.end()
        } else socket.write(`250 Ok${CRLF}`)
      }
    })
  })
  return new Promise((r) => server.listen(SMTP_PORT, '127.0.0.1', () => r({ server, messages })))
}

function decode(raw) {
  return raw
    .split(/--[-\w]+/)
    .map((part) => {
      const [head = '', ...rest] = part.split(CRLF + CRLF)
      const payload = rest.join(CRLF + CRLF)
      if (/base64/i.test(head)) {
        return Buffer.from(payload.replace(/[\r\n.]/g, ''), 'base64').toString('utf8')
      }
      if (/quoted-printable/i.test(head)) {
        return payload
          .replace(/=\r\n/g, '')
          .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      }
      return payload
    })
    .join('\n')
}

// -------------------------------------------------------------------- CDP
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let msgId = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
await new Promise((r) => ws.addEventListener('open', r))
const cdp = (method, params = {}) =>
  new Promise((res) => {
    const i = ++msgId
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- cleanup
async function cleanup() {
  const { data: campaigns } = await db.from('campaigns').select('id').like('name', `${PREFIX}%`)
  for (const c of campaigns ?? []) await db.from('campaigns').delete().eq('id', c.id)
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  for (const u of users.users.filter((x) => x.email?.startsWith(PREFIX))) {
    await db.from('manual_orders').delete().eq('user_id', u.id)
    await db.from('buyer_profiles').delete().eq('id', u.id)
    await db.auth.admin.deleteUser(u.id)
  }
}

await cleanup()
const { server, messages } = await startServer()
console.log(`fake SMTP listening on 127.0.0.1:${SMTP_PORT}\n`)

// ------------------------------------------------- seed a known audience
const people = [
  { email: `${PREFIX}buyer1@example.com`, optIn: true, purchased: true },
  { email: `${PREFIX}buyer2@example.com`, optIn: true, purchased: true },
  { email: `${PREFIX}browser1@example.com`, optIn: true, purchased: false },
  { email: `${PREFIX}browser2@example.com`, optIn: true, purchased: false },
  { email: `${PREFIX}browser3@example.com`, optIn: true, purchased: false },
  { email: `${PREFIX}optedout@example.com`, optIn: false, purchased: false },
]
const { data: product } = await db.from('products').select('id, price').limit(1).single()

for (const p of people) {
  const { data: created } = await db.auth.admin.createUser({ email: p.email, email_confirm: true })
  p.id = created.user.id
  await db.from('buyer_profiles').insert({
    id: p.id,
    email: p.email,
    must_set_password: false,
    marketing_opt_in: p.optIn,
    unsubscribed_at: p.optIn ? null : new Date().toISOString(),
  })
  if (p.purchased) {
    await db.from('manual_orders').insert({
      product_id: product.id,
      buyer_email: p.email,
      user_id: p.id,
      amount: product.price,
      currency: 'USD',
      status: 'delivered',
    })
  }
}
console.log(`seeded ${people.length}: 2 buyers, 3 browsers, 1 opted out\n`)

// ------------------------------------------------ the consent filter itself
const { data: inAudience } = await db.from('campaign_audience').select('email')
const audienceEmails = (inAudience ?? []).map((r) => r.email)
audienceEmails.includes(`${PREFIX}optedout@example.com`)
  ? fail('opted-out account appears in campaign_audience')
  : pass('opted-out account excluded by the audience view')

// -------------------------------------------------- sign in to the admin
await cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1200, deviceScaleFactor: 1, mobile: false })
await cdp('Page.enable')
await cdp('Page.navigate', { url: 'http://localhost:3000/admin/login' })
await wait(3500)
await evaluate(`(() => {
  const e = document.querySelector('#email'), p = document.querySelector('#password');
  e.value = ${JSON.stringify(ADMIN.email)}; p.value = ${JSON.stringify(ADMIN.password)};
  e.dispatchEvent(new Event('input', { bubbles: true }));
  p.dispatchEvent(new Event('input', { bubbles: true }));
  e.closest('form').requestSubmit(); return 'ok';
})()`)
await wait(6000)
const landed = await evaluate('location.pathname')
landed === '/admin' ? pass('signed in to the admin panel') : fail(`login landed on ${landed}`)

// --------------------------------------------------- create the campaign
const { data: campaign } = await db
  .from('campaigns')
  .insert({
    name: `${PREFIX}run`,
    subject: 'Test campaign subject',
    heading: 'Something new',
    intro: 'This is a campaign engine test with enough text to pass validation.',
    bullets: ['One', 'Two'],
    cta_label: 'Browse',
    cta_url: 'https://docsy.test/products',
    audience: 'no-purchase',
    status: 'draft',
  })
  .select('id')
  .single()

// ---------------------------------------- send it through the real UI
await cdp('Page.navigate', { url: `http://localhost:3000/admin/campaigns/${campaign.id}` })
await wait(4000)

const clicked = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /send campaign/i.test(x.innerText));
  if (!b) return 'no send button';
  b.click(); return 'armed';
})()`)
await wait(800)
const confirmed = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /yes, send it now/i.test(x.innerText));
  if (!b) return 'no confirm button';
  b.click(); return 'sending';
})()`)
console.log(`  UI: ${clicked} -> ${confirmed}`)

// Wait for the client-side batch loop to finish.
for (let i = 0; i < 40; i++) {
  await wait(1000)
  const { data: c } = await db.from('campaigns').select('status').eq('id', campaign.id).single()
  const { data: rows } = await db.from('campaign_sends').select('status').eq('campaign_id', campaign.id)
  const pendingRows = (rows ?? []).filter((r) => r.status === 'pending').length
  if (c.status !== 'sending' && pendingRows === 0 && (rows ?? []).length > 0) break
}
await wait(600)

// --------------------------------------------------------- assertions
const { data: sends } = await db
  .from('campaign_sends')
  .select('email, status, error')
  .eq('campaign_id', campaign.id)

const sentEmails = (sends ?? []).filter((s) => s.status === 'sent').map((s) => s.email).sort()
const expected = [
  `${PREFIX}browser1@example.com`,
  `${PREFIX}browser2@example.com`,
  `${PREFIX}browser3@example.com`,
].sort()

JSON.stringify(sentEmails) === JSON.stringify(expected)
  ? pass(`sent to exactly the no-purchase segment (${sentEmails.length})`)
  : fail(`wrong recipients: ${sentEmails.join(', ')}`)

messages.length === 3
  ? pass('exactly three emails reached the SMTP server')
  : fail(`${messages.length} emails hit the server, expected 3`)

const delivered = messages.flatMap((m) => m.to).sort()
JSON.stringify(delivered) === JSON.stringify(expected)
  ? pass('SMTP envelope recipients match the segment')
  : fail(`envelope recipients: ${delivered.join(', ')}`)

// Per-recipient unsubscribe tokens.
const tokens = new Map()
for (const p of people) {
  const { data } = await db.from('buyer_profiles').select('unsubscribe_token').eq('id', p.id).single()
  tokens.set(p.email, data.unsubscribe_token)
}
let tokenOk = messages.length > 0
for (const m of messages) {
  const body = decode(m.raw)
  const own = tokens.get(m.to[0])
  if (!own || !body.includes(own)) tokenOk = false
  for (const [email, tok] of tokens) {
    if (email !== m.to[0] && tok && body.includes(tok)) tokenOk = false
  }
}
tokenOk
  ? pass("each email carries only its own recipient's unsubscribe token")
  : fail('unsubscribe tokens missing or leaked between recipients')

const brandOk = messages.every((m) => {
  const b = decode(m.raw)
  return b.includes('Oswald') && b.includes('EB2437')
})
brandOk ? pass('campaign emails carry the brand font and colour') : fail('brand missing from campaign email')

// Re-running the send must not mail anyone a second time.
const before = messages.length
await db.rpc('queue_campaign', { p_campaign_id: campaign.id })
const { count: afterRequeue } = await db
  .from('campaign_sends')
  .select('id', { count: 'exact', head: true })
  .eq('campaign_id', campaign.id)
afterRequeue === (sends ?? []).length
  ? pass('re-queueing a finished campaign adds nobody')
  : fail(`re-queue changed the row count to ${afterRequeue}`)

await cdp('Page.navigate', { url: `http://localhost:3000/admin/campaigns/${campaign.id}` })
await wait(3000)
const reSent = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /send campaign|continue sending/i.test(x.innerText));
  return b ? 'send control still offered' : 'no send control (already finished)';
})()`)
await wait(1500)
messages.length === before
  ? pass(`no duplicate emails after revisiting the finished campaign (${reSent})`)
  : fail(`${messages.length - before} extra emails sent on revisit`)

// -------------------------- consent re-checked between queue and send
const { data: c2 } = await db
  .from('campaigns')
  .insert({
    name: `${PREFIX}consent`,
    subject: 'Second run',
    heading: 'Second run',
    intro: 'Testing that consent is re-checked at the moment of sending, not just at queue time.',
    cta_label: 'Browse',
    cta_url: 'https://docsy.test/products',
    audience: 'purchased',
    status: 'draft',
  })
  .select('id')
  .single()

await db.rpc('queue_campaign', { p_campaign_id: c2.id })
await db
  .from('buyer_profiles')
  .update({ marketing_opt_in: false, unsubscribed_at: new Date().toISOString() })
  .eq('email', `${PREFIX}buyer1@example.com`)

const beforeConsent = messages.length
await cdp('Page.navigate', { url: `http://localhost:3000/admin/campaigns/${c2.id}` })
await wait(4000)
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /continue sending|send campaign/i.test(x.innerText));
  if (b) b.click();
  return 'clicked';
})()`)
await wait(1000)
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /yes, send it now/i.test(x.innerText));
  if (b) b.click();
  return 'confirmed';
})()`)

for (let i = 0; i < 30; i++) {
  await wait(1000)
  const { data: rows } = await db.from('campaign_sends').select('status').eq('campaign_id', c2.id)
  if ((rows ?? []).length && (rows ?? []).every((r) => r.status !== 'pending')) break
}
await wait(600)

const newOnes = messages.slice(beforeConsent)
newOnes.every((m) => !m.to.includes(`${PREFIX}buyer1@example.com`))
  ? pass('the late opt-out received nothing')
  : fail('emailed someone who opted out after queueing')

const { data: skipped } = await db
  .from('campaign_sends')
  .select('email, status, error')
  .eq('campaign_id', c2.id)
  .eq('status', 'failed')
skipped?.some((s) => s.error?.includes('opted out'))
  ? pass(`the skip is recorded with a reason ("${skipped[0].error}")`)
  : fail(`no recorded skip reason: ${JSON.stringify(skipped)}`)

ws.close()
server.close()
await cleanup()
console.log('\ncleaned up test accounts and campaigns')
