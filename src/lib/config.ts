import 'server-only'

import { cache } from 'react'
import { createAdminClient } from './supabase/admin'
import { decryptSecret, encryptSecret, isEncryptionConfigured, maskSecret } from './secret-box'
import { CONFIG_FIELDS, isKnownConfigKey, isSecretKey } from './config-registry'
import { cachedRead, TAGS, TTL } from './cache'

/**
 * Resolved configuration: environment variables first, then the database.
 *
 * The environment wins deliberately. It is the more trusted source — set by
 * whoever can deploy — and the precedence means somebody who gains write access
 * to app_config cannot redirect the shop's payments to their own Paystack
 * account. The admin UI shows env-provided values as locked rather than
 * pretending they are editable, because silently ignoring what someone typed is
 * worse than telling them where the value actually comes from.
 */

export interface ResolvedConfig {
  value: string | null
  source: 'env' | 'database' | 'unset'
  /** Present for secrets, so the UI can confirm a key without revealing it. */
  masked?: string
}

/**
 * Read once per request.
 *
 * The storefront layout asks for the analytics IDs on every page render; without
 * this, that would be a database round trip per page. React's cache() dedupes it
 * within a single render pass.
 */
const loadRows = cache(async (): Promise<Map<string, { value: string; is_secret: boolean }>> => {
  const { data } = await createAdminClient().from('app_config').select('key, value, is_secret')

  const map = new Map<string, { value: string; is_secret: boolean }>()
  for (const row of (data as { key: string; value: string | null; is_secret: boolean }[]) ?? []) {
    if (row.value) map.set(row.key, { value: row.value, is_secret: row.is_secret })
  }
  return map
})

/** One resolved value, decrypting if needed. Never throws. */
export async function getConfig(key: string): Promise<string | null> {
  const field = CONFIG_FIELDS[key]

  if (field?.env) {
    const fromEnv = process.env[field.env]
    if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  }

  const rows = await loadRows().catch(() => new Map())
  const row = rows.get(key)
  if (!row) return null

  if (row.is_secret) {
    // A secret that will not decrypt is treated as absent rather than returned
    // as ciphertext, which would otherwise be handed to Paystack as an API key.
    return decryptSecret(row.value)
  }
  return row.value
}

/** Several at once, for a form or a layout that needs a handful. */
export async function getConfigMany(keys: string[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(keys.map(async (k) => [k, await getConfig(k)] as const))
  return Object.fromEntries(entries)
}

/**
 * Everything, annotated for the admin form.
 *
 * Secrets come back masked and never in full: this crosses to the browser, and a
 * page that is screen-shared or cached should not contain a live payment key.
 */
export async function getConfigForAdmin(): Promise<Record<string, ResolvedConfig>> {
  const rows = await loadRows().catch(() => new Map())
  const out: Record<string, ResolvedConfig> = {}

  for (const [key, field] of Object.entries(CONFIG_FIELDS)) {
    const fromEnv = field.env ? process.env[field.env]?.trim() : undefined

    if (fromEnv) {
      out[key] = {
        value: field.secret ? null : fromEnv,
        source: 'env',
        masked: field.secret ? maskSecret(fromEnv) : undefined,
      }
      continue
    }

    const row = rows.get(key)
    if (!row) {
      out[key] = { value: null, source: 'unset' }
      continue
    }

    if (field.secret) {
      const plain = decryptSecret(row.value)
      out[key] = {
        value: null,
        source: 'database',
        masked: plain ? maskSecret(plain) : 'stored, but cannot be decrypted',
      }
    } else {
      out[key] = { value: row.value, source: 'database' }
    }
  }

  return out
}

/**
 * Writes one value.
 *
 * Refuses unknown keys, so a crafted form post cannot create arbitrary rows, and
 * refuses to store a secret at all without an encryption key — a plaintext
 * payment secret in a database row would be worse than not offering this feature.
 * `is_secret` is taken from the registry rather than the caller, so nothing can be
 * submitted as public and then read back in full.
 */
export async function setConfig(
  key: string,
  rawValue: string,
  adminId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isKnownConfigKey(key)) return { ok: false, error: `Unknown setting: ${key}` }

  const field = CONFIG_FIELDS[key]
  if (field.env && process.env[field.env]?.trim()) {
    return {
      ok: false,
      error: `${field.label} is set by the ${field.env} environment variable, which takes precedence. Remove it there to manage this here.`,
    }
  }

  const value = rawValue.trim()
  const db = createAdminClient()

  // Empty means clear. Deleting rather than storing an empty string keeps
  // "unset" and "set to nothing" from being two states that behave the same.
  if (!value) {
    await db.from('app_config').delete().eq('key', key)
    return { ok: true }
  }

  let stored = value
  if (field.secret) {
    if (!isEncryptionConfigured()) {
      return {
        ok: false,
        error:
          'Cannot store secrets without CONFIG_ENCRYPTION_KEY. Set it in the environment first — storing a payment key unencrypted is not an option.',
      }
    }
    stored = encryptSecret(value)
  }

  const { error } = await db.from('app_config').upsert(
    {
      key,
      value: stored,
      is_secret: isSecretKey(key),
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ------------------------------------------------------- typed conveniences

/** Analytics IDs for the storefront. Public by nature. */
async function getAnalyticsConfigUncached() {
  const c = await getConfigMany([
    'analytics.ga4_id',
    'analytics.gtm_id',
    'analytics.meta_pixel_id',
    'analytics.tiktok_pixel_id',
  ])
  return {
    ga4: c['analytics.ga4_id'],
    gtm: c['analytics.gtm_id'],
    metaPixel: c['analytics.meta_pixel_id'],
    tiktokPixel: c['analytics.tiktok_pixel_id'],
  }
}

/**
 * Cached, because this is read in the storefront layout.
 *
 * An uncached read there opts every page under that layout out of static
 * rendering - including /privacy and /terms, which have no data at all. Only
 * public measurement IDs come back, so nothing secret is cached.
 */
export const getAnalyticsConfig = cachedRead(
  getAnalyticsConfigUncached,
  ['getAnalyticsConfig'],
  { tags: [TAGS.config], revalidate: TTL.config }
)

