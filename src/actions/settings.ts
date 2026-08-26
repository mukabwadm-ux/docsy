'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SettingsState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
}

const schema = z.object({
  usd_to_kes: z.coerce
    .number()
    .min(1, 'A rate below 1 would price shillings above dollars.')
    .max(100000, 'That rate looks like a typo.'),
  kes_rounding: z.coerce.number().int().min(1).max(100),
  geo_pricing_enabled: z.coerce.boolean(),
})

/**
 * Updates the exchange rate the shop publishes.
 *
 * Deliberately manual. A live FX feed would mean the price on a product page
 * could differ from the price at checkout thirty seconds later, and an outage at
 * the feed would take pricing down with it. A shop needs a rate it controls and
 * can reason about, even if it is a day behind the market.
 */
export async function updateRates(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const session = await assertAdmin()
  if (!session) return { status: 'error', message: 'You are not signed in as an admin.' }

  const parsed = schema.safeParse({
    usd_to_kes: formData.get('usd_to_kes'),
    kes_rounding: formData.get('kes_rounding') || 10,
    geo_pricing_enabled: formData.get('geo_pricing_enabled') === 'on',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    }
    return { status: 'error', fieldErrors, message: 'Check the values below.' }
  }

  const { error } = await createAdminClient()
    .from('store_settings')
    .update({ ...parsed.data, rate_updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return { status: 'error', message: error.message }

  /**
   * Every cached page showing a price is now wrong. Revalidating here is what
   * stops a rate change taking up to a minute to appear — and a stale KES price
   * is a price the shop would have to honour.
   */
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  return { status: 'success', message: 'Rate saved. Prices update everywhere immediately.' }
}
