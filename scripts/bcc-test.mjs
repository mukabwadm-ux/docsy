/**
 * Checks the owner-copy behaviour.
 *
 *   node scripts/bcc-test.mjs
 *
 * Two things could be wrong and both matter: the copy might not actually be
 * delivered, or it might be delivered as a visible header the buyer can read. A
 * receipt that shows the shop's internal address to every customer is a small
 * leak repeated on every sale.
 */
import net from 'node:net'
import nodemailer from 'nodemailer'

const CRLF = '\r\n'
const PORT = 2527
const FROM = 'Docsy <docsy@imprinnt.co>'
const BUYER = 'buyer@example.com'
const OWNER = 'docsy@imprinnt.co'

const pass = (m) => console.log(`  PASS  ${m}`)
const fail = (m) => {
  console.log(`  FAIL  ${m}`)
  process.exitCode = 1
}

function startServer() {
  const messages = []
  const server = net.createServer((socket) => {
    let inData = false
    let buffer = ''
    let rcpt = []
    socket.write(`220 localhost ready${CRLF}`)
    socket.on('data', (chunk) => {
      const text = chunk.toString()
      if (inData) {
        buffer += text
        if (buffer.includes(`${CRLF}.${CRLF}`)) {
          inData = false
          messages.push({ rcpt: rcpt.slice(), raw: buffer })
          buffer = ''
          rcpt = []
          socket.write(`250 Ok${CRLF}`)
        }
        return
      }
      for (const line of text.split(CRLF).filter(Boolean)) {
        const cmd = line.toUpperCase()
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
          socket.write(`250-localhost${CRLF}250 AUTH PLAIN LOGIN${CRLF}`)
        } else if (cmd.startsWith('AUTH')) socket.write(`235 Ok${CRLF}`)
        else if (cmd.startsWith('RCPT TO')) {
          rcpt.push(line.slice(line.indexOf(':') + 1).trim().replace(/[<>]/g, ''))
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
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r({ server, messages })))
}

const { server, messages } = await startServer()
const transporter = nodemailer.createTransport({
  host: '127.0.0.1',
  port: PORT,
  secure: false,
  auth: { user: 'u', pass: 'p' },
})

// ------------------------------------------------ a transactional send, copied
await transporter.sendMail({
  from: FROM,
  to: BUYER,
  bcc: OWNER,
  replyTo: FROM,
  subject: 'Your Docsy receipt',
  text: 'Receipt body',
  html: '<p>Receipt body</p>',
})
await new Promise((r) => setTimeout(r, 300))

const sent = messages[0]
sent.rcpt.includes(BUYER) ? pass('buyer is an envelope recipient') : fail('buyer missing')
sent.rcpt.includes(OWNER)
  ? pass('owner copy is an envelope recipient — it will actually be delivered')
  : fail('owner copy was NOT delivered')
sent.rcpt.length === 2
  ? pass('exactly two recipients, so nobody is mailed twice')
  : fail(`unexpected recipients: ${sent.rcpt.join(', ')}`)

const headers = sent.raw.split(CRLF + CRLF)[0] ?? ''
// Assigned first: a statement beginning with / is parsed as division, not a regex.
const hasBccHeader = /bcc:/i.test(headers)
const toIsBuyerOnly = /^to:.*buyer@example\.com/im.test(headers)

hasBccHeader
  ? fail('a Bcc header is present — the buyer can see the shop address')
  : pass('no Bcc header in the message, so the copy stays invisible to the buyer')
toIsBuyerOnly ? pass('To header shows only the buyer') : fail('To header is wrong')

// -------------------------------- the app-level rules, mirrored from mailer.ts
const decide = (opts, copyTo, to) =>
  opts.copyToOwner && copyTo && copyTo.toLowerCase() !== to.toLowerCase() ? copyTo : null

const cases = [
  [{ copyToOwner: true }, OWNER, BUYER, OWNER, 'transactional mail is copied'],
  [{}, OWNER, BUYER, null, 'a campaign send is never copied'],
  [{ copyToOwner: true }, null, BUYER, null, 'no copy address means no copy'],
  [
    { copyToOwner: true },
    OWNER,
    'DOCSY@IMPRINNT.CO',
    null,
    'the owner buying from their own shop is not copied twice',
  ],
  [{ copyToOwner: true }, OWNER, 'other@example.com', OWNER, 'a different buyer is copied'],
]
let ok = true
for (const [opts, copyTo, to, want, label] of cases) {
  const got = decide(opts, copyTo, to)
  if (got !== want) {
    fail(`${label}: got ${got}, wanted ${want}`)
    ok = false
  }
}
if (ok) pass(`all ${cases.length} copy rules behave`)

server.close()
