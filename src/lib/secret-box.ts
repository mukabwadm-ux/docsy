import 'server-only'

import crypto from 'node:crypto'

/**
 * Authenticated encryption for configuration secrets.
 *
 * AES-256-GCM. GCM rather than CBC because it authenticates as well as encrypts:
 * ciphertext that has been tampered with fails to decrypt instead of silently
 * yielding different plaintext. For a stored payment key, "it decrypted to
 * something else" would be far worse than "it failed".
 *
 * The key comes from CONFIG_ENCRYPTION_KEY and is never written to the database.
 * That separation is the point — reaching Postgres alone yields ciphertext.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits, the size GCM is specified for
const VERSION = 'v1'

export function isEncryptionConfigured() {
  return Boolean(resolveKey())
}

export const ENCRYPTION_SETUP_HINT =
  'Set CONFIG_ENCRYPTION_KEY (32 bytes, base64 or 64 hex characters) to store secrets. Generate one with: openssl rand -base64 32'

/**
 * Accepts base64 or hex, and refuses anything that is not exactly 32 bytes.
 *
 * A short key would be silently padded by some implementations and produce
 * encryption far weaker than it appears, so this rejects rather than coerces.
 */
function resolveKey(): Buffer | null {
  const raw = process.env.CONFIG_ENCRYPTION_KEY
  if (!raw) return null

  const trimmed = raw.trim()
  let key: Buffer | null = null

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex')
  } else {
    try {
      const decoded = Buffer.from(trimmed, 'base64')
      if (decoded.length === 32) key = decoded
    } catch {
      key = null
    }
  }

  return key && key.length === 32 ? key : null
}

/**
 * Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url.
 *
 * The version prefix is there so a future change of algorithm can be rolled out
 * without having to guess how any given existing row was encrypted.
 */
export function encryptSecret(plaintext: string): string {
  const key = resolveKey()
  if (!key) throw new Error(ENCRYPTION_SETUP_HINT)

  // A fresh random IV per encryption. Reusing one under the same key is the
  // single mistake that breaks GCM outright.
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

/** Null on any failure — a wrong key, a tampered value, an unknown version. */
export function decryptSecret(stored: string): string | null {
  const key = resolveKey()
  if (!key) return null

  const parts = stored.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) return null

  try {
    const iv = Buffer.from(parts[1], 'base64url')
    const tag = Buffer.from(parts[2], 'base64url')
    const ciphertext = Buffer.from(parts[3], 'base64url')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    // Includes the authentication failure GCM raises on tampering, which is the
    // case worth swallowing quietly rather than surfacing as a stack trace.
    return null
  }
}

/**
 * What the admin UI shows instead of a stored secret.
 *
 * Enough to confirm the right key is in place — the prefix says test or live at a
 * glance — without putting the secret back on screen or in the HTML source of a
 * page that might be screen-shared.
 */
export function maskSecret(value: string): string {
  const clean = value.trim()
  if (clean.length <= 8) return '••••••••'
  return `${clean.slice(0, 7)}${'•'.repeat(12)}${clean.slice(-4)}`
}
