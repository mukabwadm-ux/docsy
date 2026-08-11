import 'server-only'

import { createAdminClient } from './supabase/admin'

const BUCKET = 'digital-products'

/** Seven days: long enough for a buyer in any timezone to get around to it. */
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7

/**
 * Mints a time-limited download URL for a paid file.
 *
 * This is the only way a file leaves the private bucket. The bucket has no
 * public read policy at all (migration 0004), so a signed URL is not merely the
 * convenient path — it is the only one, which is what makes the paywall
 * structural rather than a matter of remembering to check something.
 *
 * The link expires, so it is safe to paste into an email: a forwarded receipt
 * stops working rather than becoming a permanent free mirror of the product.
 */
export async function createSignedDownloadUrl(
  filePath: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<{ url: string } | { error: string }> {
  if (!filePath) return { error: 'This product has no file attached yet.' }

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(filePath, ttlSeconds)

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? 'Could not create a download link.' }
  }
  return { url: data.signedUrl }
}

/** Human-readable expiry to put next to the link in the admin UI. */
export function describeExpiry(ttlSeconds = DEFAULT_TTL_SECONDS) {
  const days = Math.round(ttlSeconds / 86400)
  return days === 1 ? '24 hours' : `${days} days`
}
