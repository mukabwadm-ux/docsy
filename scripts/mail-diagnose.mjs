/**
 * Diagnoses an SMTP host without ever attempting to log in.
 *
 * Why this exists: a wrong hostname and a wrong password produce the *same*
 * error, `535 authentication failed`. Retrying the password is then the obvious
 * move and the wrong one — it cannot succeed, and enough failed logins get the IP
 * jailed by fail2ban, turning a config problem into an outage. This asks the
 * questions that separate the two causes, using no credentials at all:
 *
 *   1. Is the host reachable on the submission port?
 *   2. Is its TLS certificate valid for that hostname?
 *   3. Does it advertise an AUTH mechanism nodemailer can use?
 *   4. Does it actually host the domain in SMTP_USER?
 *
 * (4) is the one that matters. On port 25 a server accepts RCPT for domains it
 * holds and answers "relay access denied" for domains it does not. A cPanel
 * account lives on one specific server, so "the mailbox is active" can be true
 * while the configured host has never heard of the domain.
 */
import net from 'node:net'
import tls from 'node:tls'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') })

const CRLF = '\r\n'
const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT ?? 587) || 587
const user = process.env.SMTP_USER ?? ''
const domain = user.includes('@') ? user.split('@')[1] : null

if (!host) {
  console.error('SMTP_HOST is not set. Nothing to diagnose.')
  process.exit(1)
}

const ok = (s) => `  \u001b[32mOK\u001b[0m    ${s}`
const bad = (s) => `  \u001b[31mFAIL\u001b[0m  ${s}`
const meh = (s) => `  \u001b[33m??\u001b[0m    ${s}`

/** Reads one complete SMTP reply; multi-line replies end with "NNN " not "NNN-". */
function talk(sock, cmd) {
  return new Promise((resolve) => {
    let buf = ''
    const onData = (d) => {
      buf += d.toString()
      const last = buf.split(/(?<=\r\n)/).slice(-1)[0] ?? ''
      if (/^\d{3} /.test(last)) {
        sock.off('data', onData)
        resolve(buf.trimEnd())
      }
    }
    sock.on('data', onData)
    sock.once('timeout', () => { sock.off('data', onData); resolve('(timeout)') })
    sock.once('error', () => { sock.off('data', onData); resolve('(error)') })
    if (cmd !== null) sock.write(cmd + CRLF)
  })
}

function connect(h, p, timeout = 9000) {
  return new Promise((resolve) => {
    const sock = net.connect(p, h)
    sock.setTimeout(timeout)
    sock.once('connect', () => resolve(sock))
    sock.once('timeout', () => { sock.destroy(); resolve('timeout') })
    sock.once('error', (e) => { sock.destroy(); resolve(e.code ?? 'error') })
  })
}

console.log(`\nDiagnosing ${host}:${port}`)
console.log(`Username    ${user || '(not set)'}`)
console.log('No login is attempted at any point.\n')

// ---------------------------------------------- 1 & 2 & 3: submission port
console.log(`Submission port ${port}`)
const sub = await connect(host, port)
if (typeof sub === 'string') {
  console.log(bad(`cannot reach ${host}:${port} (${sub})`))
  if (sub === 'timeout' || sub === 'ETIMEDOUT') {
    console.log(`        A timeout usually means the hostname points somewhere that is not a`)
    console.log(`        mail server at all — check where ${host} actually resolves.`)
  }
} else {
  const banner = await talk(sub, null)
  console.log(ok(`connected — ${banner.split(CRLF)[0]}`))

  let caps = await talk(sub, 'EHLO diagnose.local')
  let secured = sub

  if (port !== 465 && /STARTTLS/i.test(caps)) {
    await talk(sub, 'STARTTLS')
    secured = tls.connect({ socket: sub, servername: host })
    const handshake = await new Promise((r) => {
      secured.once('secure', () => r(true))
      secured.once('error', (e) => r(e.message))
    })
    if (handshake === true) {
      const cert = secured.getPeerCertificate()
      if (secured.authorized) {
        console.log(ok(`TLS valid for ${host} (certificate: ${cert.subject?.CN}, expires ${cert.valid_to})`))
      } else {
        const names = [cert.subject?.CN, cert.subjectaltname].filter(Boolean).join(', ')
        console.log(bad(`TLS certificate is not valid for ${host}: ${secured.authorizationError}`))
        console.log(`        The certificate is for: ${names}`)
        console.log(`        Use that hostname in SMTP_HOST. Do not disable verification —`)
        console.log(`        that would send this mailbox's password to an unverified server.`)
      }
      caps = await talk(secured, 'EHLO diagnose.local')
    } else {
      console.log(bad(`STARTTLS handshake failed: ${handshake}`))
    }
  }

  const auth = caps.split(CRLF).find((l) => /^250[ -]AUTH /i.test(l))
  if (auth) {
    const mechs = auth.replace(/^250[ -]AUTH /i, '').trim()
    const usable = /PLAIN|LOGIN/i.test(mechs)
    console.log((usable ? ok : meh)(`AUTH offered: ${mechs}`))
    if (!usable) console.log('        nodemailer needs PLAIN or LOGIN; neither is offered.')
  } else {
    console.log(meh('no AUTH mechanisms advertised — the server may require TLS first'))
  }

  await talk(secured, 'QUIT')
  secured.destroy()
  sub.destroy()
}

// ------------------------------------------- 4: does this host hold the domain?
if (!domain) {
  console.log('\nSMTP_USER is not an email address, so the domain check is skipped.')
  process.exit(0)
}

/**
 * The hosting question only makes sense for a server that is supposed to carry
 * your own domain — a shared or cPanel host. A public provider authenticates you
 * as its own user and relays on your behalf, so "does it host your domain" is not
 * a meaningful question, and its port 25 would only answer "STARTTLS first".
 */
const PROVIDERS = /gmail|googlemail|outlook|office365|hotmail|sendgrid|mailgun|postmark|zoho|resend|amazonaws|yandex|fastmail/i
if (PROVIDERS.test(host)) {
  console.log(`
${host} is a mail provider, not a host for ${domain}.`)
  console.log(ok('Nothing more to check — it relays as its authenticated user.'))
  const from = process.env.EMAIL_FROM ?? ''
  if (from && !from.includes(user)) {
    console.log(meh(`EMAIL_FROM does not use ${user}.`))
    console.log('        Providers usually rewrite or reject a From they do not own, so set')
    console.log(`        EMAIL_FROM to ${user} unless that alias is verified with them.`)
  } else if (from) {
    console.log(ok(`EMAIL_FROM matches the authenticated account.`))
  }
  process.exit(0)
}

console.log(`\nDoes ${host} host ${domain}?`)
const inbound = await connect(host, 25)
if (typeof inbound === 'string') {
  console.log(meh(`port 25 is unreachable from here (${inbound}) — many ISPs block it.`))
  console.log(`        This check needs port 25. Skipping it; run it from another network`)
  console.log(`        if the password is confirmed correct and login still fails.`)
} else {
  await talk(inbound, null)
  await talk(inbound, 'EHLO diagnose.local')
  await talk(inbound, 'MAIL FROM:<diagnose@example.net>')

  const wanted = await talk(inbound, `RCPT TO:<${user}>`)
  // Control: a domain no server hosts. If the reply matches the one above, the
  // server refuses everything unauthenticated and the test proves nothing —
  // this guard is what stops a false "the domain is hosted here".
  const control = await talk(inbound, 'RCPT TO:<probe@invalid-control-domain-q7x.test>')
  await talk(inbound, 'QUIT')
  inbound.destroy()

  /**
   * The control exists to catch a server that accepts every recipient, which
   * would make an acceptance meaningless. It does NOT invalidate a rejection:
   * the control is unhosted everywhere, so both being refused is the expected
   * shape when the target domain is genuinely not here.
   */
  const controlAccepted = /^2/.test(control)

  if (/^2/.test(wanted) && controlAccepted) {
    console.log(meh('inconclusive — this server accepts any recipient, including a domain'))
    console.log('        that does not exist, so acceptance proves nothing.')
  } else if (/^2/.test(wanted)) {
    console.log(ok(`yes — ${host} accepts mail for ${user}, so the domain and mailbox are here.`))
    console.log('        A 535 against this host is therefore a genuine password problem.')
  } else if (/relay/i.test(wanted)) {
    console.log(bad(`no — ${host} answered "relay access denied" for ${domain}.`))
    console.log(`        ${wanted.split(CRLF)[0]}`)
    console.log(`        Postfix says that only for domains it does not hold, so no password`)
    console.log(`        can ever authenticate ${user} here. SMTP_HOST is the wrong server.`)
    console.log('')
    console.log('        Get the right hostname from cPanel: Email Accounts -> the mailbox ->')
    console.log('        Connect Devices, which prints the exact SMTP host for this account.')
  } else if (/user unknown|does not exist|no such|mailbox unavailable/i.test(wanted)) {
    console.log(bad(`${host} holds ${domain}, but does not know the mailbox ${user}.`))
    console.log(`        ${wanted.split(CRLF)[0]}`)
  } else {
    console.log(meh(`unclear reply: ${wanted.split(CRLF)[0]}`))
    console.log(`        control replied: ${control.split(CRLF)[0]}`)
  }
}
console.log('')
