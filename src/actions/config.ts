'use server'

import { revalidatePath } from 'next/cache'
import { assertAdmin } from '@/lib/auth'
import { setConfig } from '@/lib/config'
import { CONFIG_FIELDS, CONFIG_GROUPS, type ConfigGroupId } from '@/lib/config-registry'
import { isEncryptionConfigured, maskSecret } from '@/lib/secret-box'
import { mailSettings, verifyTransport } from '@/lib/mailer'
import { isPaystackConfigured, secretKey } from '@/lib/paystack'

export interface ConfigState {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** Per-field problems, keyed by config key. */
  fieldErrors?: Record<string, string>
}

const DENIED: ConfigState = { status: 'error', message: 'You are not signed in as an admin.' }

/**
 * Saves one group at a time.
 *
 * Per group rather than one big form so a failure in the analytics section cannot
 * roll back a payment key that saved fine, and so the success message can name
 * what was actually changed.
 *
 * A blank secret field means "leave it alone", not "clear it" — the field renders
 * empty by design, since the stored value is never sent to the browser, and
 * treating empty as a deletion would wipe a payment key every time the form was
 * submitted to change something else.
 */
export async function saveConfigGroup(
  _prev: ConfigState,
  formData: FormData
): Promise<ConfigState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const groupId = String(formData.get('group') ?? '') as ConfigGroupId
  const group = CONFIG_GROUPS.find((g) => g.id === groupId)
  if (!group) return { status: 'error', message: 'Unknown settings group.' }

  const fieldErrors: Record<string, string> = {}
  const saved: string[] = []

  for (const field of group.fields) {
    const raw = formData.get(field.key)
    if (raw === null) continue

    const value = String(raw).trim()

    // Blank secret: no change intended.
    if (field.secret && !value) continue

    // Env-provided values are read-only; the input is disabled, so a value here
    // means someone bypassed the form. Skip rather than error.
    if (field.env && process.env[field.env]?.trim()) continue

    const result = await setConfig(field.key, value, session.userId)
    if (!result.ok) {
      fieldErrors[field.key] = result.error
    } else {
      saved.push(field.label)
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      fieldErrors,
      message: 'Some settings could not be saved.',
    }
  }

  /**
   * Analytics IDs are read by the storefront layout, so every cached page has to
   * be rebuilt for a new tag to appear. Cheap here, and the alternative is the
   * owner adding a pixel and concluding it does not work.
   */
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')

  return {
    status: 'success',
    message: saved.length ? `Saved ${group.label.toLowerCase()}.` : 'Nothing changed.',
  }
}

/** Clears one stored value, for when a key needs removing rather than replacing. */
export async function clearConfigValue(key: string): Promise<ConfigState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const field = CONFIG_FIELDS[key]
  if (!field) return { status: 'error', message: 'Unknown setting.' }

  const result = await setConfig(key, '', session.userId)
  if (!result.ok) return { status: 'error', message: result.error }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  return { status: 'success', message: `${field.label} cleared.` }
}

/**
 * Checks the mail settings without sending anything.
 *
 * Worth its own button: an SMTP problem otherwise surfaces as a failed delivery
 * to a real buyer, and "wrong port" and "wrong password" look identical from
 * there.
 */
export async function testEmailConnection(): Promise<ConfigState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  /**
   * Report what is about to be attempted, not just the outcome.
   *
   * A connection failure is nearly always a wrong host or port, and seeing the
   * exact target echoed back catches a typo immediately — whereas "connection
   * timeout" alone sends people to check their password.
   */
  const settings = await mailSettings()
  const target =
    settings.transport === 'smtp' && settings.smtp
      ? `${settings.smtp.host}:${settings.smtp.port} (TLS ${settings.smtp.secure ? 'implicit' : 'STARTTLS'})`
      : settings.transport === 'resend'
        ? 'Resend API'
        : 'nothing configured'

  const result = await verifyTransport()
  return result.ok
    ? {
        status: 'success',
        message: `Connected to ${target} and the credentials were accepted. Sending from ${settings.from}.`,
      }
    : { status: 'error', message: `Tried ${target}. ${result.error}` }
}

/**
 * Confirms the Paystack key works, by asking Paystack.
 *
 * A key that is merely present tells you nothing — a typo, a revoked key and a
 * test key on a live account all look identical until something is charged. This
 * calls an endpoint that requires authentication and reports what came back.
 */
export async function testPaystackConnection(): Promise<ConfigState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  if (!(await isPaystackConfigured())) {
    return { status: 'error', message: 'No Paystack secret key is set.' }
  }

  const key = await secretKey()
  const mode = key?.startsWith('sk_live_') ? 'live' : 'test'

  try {
    const res = await fetch('https://api.paystack.co/transaction/totals?perPage=1', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string }

    if (!res.ok || !body.status) {
      return {
        status: 'error',
        message: `Paystack rejected the key: ${body.message ?? `HTTP ${res.status}`}`,
      }
    }
    return {
      status: 'success',
      message: `Paystack key accepted — ${mode} mode.${mode === 'test' ? ' No real money will move.' : ''}`,
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return { status: 'error', message: `Could not reach Paystack (${reason}).` }
  }
}

/** Whether secrets can be stored at all, for the UI to warn about up front. */
export async function encryptionStatus(): Promise<{ ready: boolean; hint: string; sample: string }> {
  return {
    ready: isEncryptionConfigured(),
    hint: 'Set CONFIG_ENCRYPTION_KEY in the environment before storing secrets here.',
    sample: maskSecret('sk_live_example_key_value_here'),
  }
}
