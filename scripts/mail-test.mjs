/**
 * Checks the mail transport.
 *
 *   node scripts/mail-test.mjs                 # against a throwaway local SMTP server
 *   node scripts/mail-test.mjs you@email.com   # a real send, using .env.local
 *
 * With no argument it starts a fake SMTP server on localhost that speaks just
 * enough of the protocol to accept a message, then prints what actually arrived.
 * That exercises the transport, the AUTH handshake and the MIME body without
 * needing credentials or touching a real inbox.
 *
 * With an address it sends for real through whatever .env.local is configured for,
 * which is the only way to answer "does it arrive, and how fast".
 */
import net from 'node:net'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const CRLF = '\r\n'
const PORT = 2525
const recipient = process.argv[2]

const pass = (m) => console.log(`  PASS  ${m}`)
const fail = (m) => {
  console.log(`  FAIL  ${m}`)
  process.exitCode = 1
}

const SUBJECT = 'Docsy mail transport test'
const HTML =
  '<!doctype html><html><body style="background:#FFF6DB">' +
  '<h1 style="font-family:\'Oswald\',sans-serif;text-transform:uppercase">Transport works</h1>' +
  '<p style="font-family:\'Lora\',Georgia,serif">If you can read this, Docsy can send email.</p>' +
  '</body></html>'
const TEXT = 'Transport works.\n\nIf you can read this, Docsy can send email.'

// ---------------------------------------------------------------- real send
if (recipient) {
  const host = process.env.SMTP_HOST
  const from = process.env.EMAIL_FROM
  if (!from) {
    console.error('EMAIL_FROM is not set in .env.local')
    process.exit(1)
  }

  if (host) {
    const port = Number(process.env.SMTP_PORT ?? 587)
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465
    console.log(`transport: SMTP ${host}:${port} (secure=${secure})`)

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000,
    })

    try {
      await transporter.verify()
      pass('server reachable and credentials accepted')
    } catch (err) {
      fail(`verify failed: ${err.message}`)
      process.exit(1)
    }

    const started = Date.now()
    try {
      const info = await transporter.sendMail({
        from,
        to: recipient,
        replyTo: from,
        subject: SUBJECT,
        text: TEXT,
        html: HTML,
      })
      pass(`accepted by the server in ${Date.now() - started}ms (id ${info.messageId})`)
      console.log(`\n  Now check ${recipient}. Time from here to the inbox is the receiving`)
      console.log('  provider deciding, not Docsy — that is the number worth measuring.')
    } catch (err) {
      fail(`send failed: ${err.message}`)
    }
    process.exit()
  }

  if (process.env.RESEND_API_KEY) {
    console.log('transport: Resend HTTP API')
    const started = Date.now()
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [recipient], subject: SUBJECT, html: HTML, text: TEXT }),
    })
    const body = await res.json().catch(() => ({}))
    res.ok
      ? pass(`accepted by Resend in ${Date.now() - started}ms (id ${body.id ?? 'unknown'})`)
      : fail(`Resend rejected it: ${body.message ?? res.status}`)
    process.exit()
  }

  console.error('Neither SMTP_HOST nor RESEND_API_KEY is set in .env.local')
  process.exit(1)
}

// ------------------------------------------------------- local fake server
function startFakeServer() {
  const received = { raw: '', from: '', to: [], authenticated: false }

  const server = net.createServer((socket) => {
    let inData = false
    socket.write(`220 localhost Fake SMTP ready${CRLF}`)

    socket.on('data', (chunk) => {
      const text = chunk.toString()

      if (inData) {
        received.raw += text
        if (received.raw.includes(`${CRLF}.${CRLF}`)) {
          inData = false
          socket.write(`250 2.0.0 Ok: queued as FAKE1${CRLF}`)
        }
        return
      }

      for (const line of text.split(CRLF).filter(Boolean)) {
        const cmd = line.toUpperCase()
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
          // Advertise AUTH so nodemailer performs the exchange rather than
          // skipping it — the point is to exercise the real code path.
          socket.write(`250-localhost${CRLF}250-AUTH PLAIN LOGIN${CRLF}250 SIZE 10485760${CRLF}`)
        } else if (cmd.startsWith('AUTH')) {
          received.authenticated = true
          socket.write(`235 2.7.0 Authentication successful${CRLF}`)
        } else if (cmd.startsWith('MAIL FROM')) {
          received.from = line.slice(line.indexOf(':') + 1).trim()
          socket.write(`250 2.1.0 Ok${CRLF}`)
        } else if (cmd.startsWith('RCPT TO')) {
          received.to.push(line.slice(line.indexOf(':') + 1).trim())
          socket.write(`250 2.1.5 Ok${CRLF}`)
        } else if (cmd.startsWith('DATA')) {
          inData = true
          socket.write(`354 End data with <CR><LF>.<CR><LF>${CRLF}`)
        } else if (cmd.startsWith('QUIT')) {
          socket.write(`221 2.0.0 Bye${CRLF}`)
          socket.end()
        } else {
          socket.write(`250 2.0.0 Ok${CRLF}`)
        }
      }
    })
  })

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve({ server, received }))
  })
}

/**
 * Decode before asserting. Nodemailer transfer-encodes each MIME part — base64 or
 * quoted-printable depending on the bytes — so searching the raw wire data for
 * body text fails even when the body is perfectly intact.
 */
function decodedParts(raw) {
  return raw.split(/--[-\w]+/).map((part) => {
    const [head = '', ...rest] = part.split(CRLF + CRLF)
    const payload = rest.join(CRLF + CRLF)

    if (/base64/i.test(head)) {
      return Buffer.from(payload.replace(/[\r\n.]/g, ''), 'base64').toString('utf8')
    }
    if (/quoted-printable/i.test(head)) {
      // Soft line breaks first, then the =XX escapes they would otherwise split.
      return payload
        .replace(/=\r\n/g, '')
        .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    }
    return payload
  })
}

console.log(`starting a fake SMTP server on 127.0.0.1:${PORT}\n`)
const { server, received } = await startFakeServer()

const FROM = 'Docsy <hello@docsy.imprinnt.co>'
const transporter = nodemailer.createTransport({
  host: '127.0.0.1',
  port: PORT,
  secure: false,
  auth: { user: 'docsy-test', pass: 'not-a-real-password' },
})

const started = Date.now()
try {
  await transporter.verify()
  pass('verify() succeeded — transport reachable and AUTH accepted')
} catch (err) {
  fail(`verify() failed: ${err.message}`)
}

try {
  await transporter.sendMail({
    from: FROM,
    to: 'buyer@example.com',
    replyTo: FROM,
    subject: SUBJECT,
    text: TEXT,
    html: HTML,
  })
  pass(`sendMail() accepted in ${Date.now() - started}ms`)
} catch (err) {
  fail(`sendMail() failed: ${err.message}`)
}

await new Promise((r) => setTimeout(r, 300))
server.close()

console.log('\nwhat the server actually received:')
console.log(`  MAIL FROM: ${received.from}`)
console.log(`  RCPT TO:   ${received.to.join(', ')}`)

const headers = received.raw.split(CRLF + CRLF)[0] ?? ''
for (const name of ['From', 'To', 'Reply-To', 'Content-Type', 'MIME-Version']) {
  const line = headers
    .split(CRLF)
    .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`))
  console.log(`  ${name.padEnd(13)} ${line ? line.slice(name.length + 1).trim() : '(absent)'}`)
}
console.log('')

const bodies = decodedParts(received.raw)
const hasHtml = bodies.some((b) => b.includes('Transport works'))
const hasText = bodies.some((b) => b.includes('If you can read this'))
const isMultipart = /multipart\/alternative/i.test(headers)

received.authenticated ? pass('AUTH exchange happened') : fail('no AUTH exchange')
received.from.includes('hello@docsy.imprinnt.co')
  ? pass('envelope sender is EMAIL_FROM')
  : fail(`unexpected envelope sender: ${received.from}`)
hasHtml ? pass('HTML body arrived intact (after MIME decoding)') : fail('HTML body missing')
hasText ? pass('plain-text alternative arrived intact') : fail('plain-text part missing')
isMultipart
  ? pass('multipart/alternative, so clients can choose text or HTML')
  : fail('not multipart — the plain-text fallback would be lost')

console.log('\nTo test a real send:  npm run mail:test -- you@example.com')
