'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2, 'Please enter your name.').max(60, 'That name is too long.'),
  location: z.string().trim().max(80).optional(),
  rating: z.coerce.number().int().min(1, 'Pick a star rating.').max(5),
  text: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters.')
    .max(1500, 'Please keep it under 1500 characters.'),
})

export interface ReviewState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'name' | 'location' | 'rating' | 'text', string>>
}

/**
 * Visitor review submission.
 *
 * Goes through a server action rather than a public INSERT policy because the
 * two fields that matter for trust — `status` and `source` — must be set by the
 * server. A WITH CHECK clause cannot prevent a client from simply posting
 * status='approved', so there is no RLS-only version of this that is safe.
 */
export async function submitReview(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const parsed = schema.safeParse({
    productId: formData.get('productId'),
    name: formData.get('name'),
    location: formData.get('location') || undefined,
    rating: formData.get('rating'),
    text: formData.get('text'),
  })

  if (!parsed.success) {
    const fieldErrors: ReviewState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'location' || key === 'rating' || key === 'text') {
        fieldErrors[key] ??= issue.message
      }
    }
    return { status: 'error', fieldErrors }
  }

  const { productId, name, location, rating, text } = parsed.data

  const { error } = await createAdminClient().from('reviews').insert({
    product_id: productId,
    reviewer_name: name,
    reviewer_location: location ?? null,
    rating,
    review_text: text,
    // Set here, never from the payload.
    source: 'visitor',
    status: 'pending',
    is_verified_purchase: false,
  })

  if (error) {
    return { status: 'error', message: 'We could not save your review. Please try again.' }
  }

  return {
    status: 'success',
    message: 'Thanks for the review — it will appear once we have read it.',
  }
}
