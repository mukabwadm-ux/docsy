'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { createSeedReview, type ActionState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'

const initial: ActionState = { status: 'idle' }

export function SeedReviewForm({ products }: { products: { id: string; title: string }[] }) {
  const [state, formAction] = useFormState(createSeedReview, initial)
  const form = useRef<HTMLFormElement>(null)

  // Clear the fields after a save so the next testimonial can be typed straight
  // in — otherwise the previous reviewer's name is still sitting there and gets
  // submitted again by accident.
  useEffect(() => {
    if (state.status === 'success') form.current?.reset()
  }, [state.status])

  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-brand-cream/40 p-4 text-sm text-brand-body">
        Create a product first — a review has to belong to one.
      </p>
    )
  }

  return (
    <form ref={form} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="seed-product">Product</Label>
          <Select id="seed-product" name="product_id" required className="mt-1.5">
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          {state.fieldErrors?.product_id && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.product_id}</p>
          )}
        </div>

        <div>
          <Label htmlFor="seed-rating">Rating</Label>
          <Select id="seed-rating" name="rating" defaultValue="5" className="mt-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? '' : 's'}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="seed-name">Reviewer name</Label>
          <Input id="seed-name" name="reviewer_name" required placeholder="Alex M." className="mt-1.5" />
          {state.fieldErrors?.reviewer_name && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.reviewer_name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="seed-location">Location (optional)</Label>
          <Input id="seed-location" name="reviewer_location" placeholder="London, UK" className="mt-1.5" />
        </div>
      </div>

      <div>
        <Label htmlFor="seed-text">Review</Label>
        <Textarea id="seed-text" name="review_text" required rows={3} className="mt-1.5" />
        {state.fieldErrors?.review_text && (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.review_text}</p>
        )}
      </div>

      {state.message && (
        <p
          className={
            state.status === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-green-700'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="dark" size="md" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Adding…' : 'Add review'}
    </Button>
  )
}
