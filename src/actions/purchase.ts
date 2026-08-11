'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Opens a checkout and sends the buyer to it.
 *
 * Email is the only required field. A digital download needs exactly one thing to
 * be deliverable — an address to send it to — and every extra required box on a
 * $19 impulse purchase is another chance to abandon.
 *
 * The order row is created here, before payment, on purpose. It means an
 * interrupted checkout is a row we already have: recoverable by URL, and
 * followable up by email. Nothing about a card is stored, now or later — a
 * gateway tokenises that in the browser and we keep only its reference.
 */

const schema = z.object({
  productId: z.string().uuid('Something went wrong — please reload the page.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email — this is where your file goes.')
    .max(160),
  name: z.string().trim().max(80, 'That name is too long.').optional(),
  note: z.string().trim().max(500, 'Please keep the note under 500 characters.').optional(),
})

export interface PurchaseState {
  status: 'idle' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'name' | 'email' | 'note', string>>
}

export async function requestPurchase(
  _prev: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const parsed = schema.safeParse({
    productId: formData.get('productId'),
    email: formData.get('email'),
    name: formData.get('name') || undefined,
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: PurchaseState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'email' || key === 'note') {
        fieldErrors[key] ??= issue.message
      }
    }
    const productIssue = parsed.error.issues.find((i) => i.path[0] === 'productId')
    return { status: 'error', fieldErrors, message: productIssue?.message }
  }

  const { productId, email, name, note } = parsed.data

  /**
   * One round trip. open_checkout reads the price itself, refuses products that
   * are not active, and returns the existing token when this buyer already has
   * an open checkout for this product — so a double tap or a reload cannot
   * produce two pending orders for one purchase.
   */
  const { data: token, error } = await createAdminClient().rpc('open_checkout', {
    p_product_id: productId,
    p_email: email,
    p_name: name ?? null,
    p_note: note ?? null,
  })

  if (error) {
    return { status: 'error', message: 'We could not start your order. Please try again.' }
  }
  if (!token) {
    return { status: 'error', message: 'This product is no longer available.' }
  }

  // redirect() throws, so it must sit outside the try/catch above and be the
  // last thing this action does.
  redirect(`/checkout/${token}`)
}
