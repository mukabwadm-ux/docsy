'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2, Star } from 'lucide-react'
import { submitReview, type ReviewState } from '@/actions/reviews'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const initial: ReviewState = { status: 'idle' }

export function ReviewForm({ productId }: { productId: string }) {
  const [state, formAction] = useFormState(submitReview, initial)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)

  if (state.status === 'success') {
    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-brand-tan bg-brand-cream p-5"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-cta" aria-hidden />
        <p className="text-[15px] text-brand-body">{state.message}</p>
      </div>
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        Write a review
      </Button>
    )
  }

  return (
    <form action={formAction} className="rounded-lg border border-border bg-white p-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />

      <p className="font-heading text-base font-bold uppercase tracking-wide text-brand-heading">
        Write a review
      </p>

      <div className="mt-4">
        <Label>Your rating</Label>
        <div
          className="mt-1.5 flex gap-1"
          role="radiogroup"
          aria-label="Star rating"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta"
            >
              <Star
                className={cn(
                  'h-7 w-7 transition-colors',
                  n <= (hovered || rating) ? 'text-brand-cta' : 'text-[#d9d3c4]'
                )}
                fill="currentColor"
                strokeWidth={0}
                aria-hidden
              />
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating && (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.rating}</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="review-name">Your name</Label>
          <Input id="review-name" name="name" required placeholder="Alex M." className="mt-1.5" />
          {state.fieldErrors?.name && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="review-location">Where you&apos;re from (optional)</Label>
          <Input
            id="review-location"
            name="location"
            placeholder="London, UK"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="review-text">Your review</Label>
        <Textarea
          id="review-text"
          name="text"
          required
          rows={4}
          maxLength={1500}
          placeholder="What did you use it for, and did it help?"
          className="mt-1.5"
        />
        {state.fieldErrors?.text && (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.text}</p>
        )}
      </div>

      {state.status === 'error' && state.message && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body/60 hover:text-brand-cta"
        >
          Cancel
        </button>
      </div>

      <p className="mt-3 text-xs text-brand-body/70">
        Reviews are read before they appear, to keep spam off the page.
      </p>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="md" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Sending…' : 'Submit review'}
    </Button>
  )
}
