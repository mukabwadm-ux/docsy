'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react'
import { requestPurchase, type PurchaseState } from '@/actions/purchase'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { discountPercent, fileTypeLabel, formatFileSize, formatPriceOrFree } from '@/lib/format'
import type { Product } from '@/lib/types'

const initial: PurchaseState = { status: 'idle' }

/**
 * The hero CTA and the purchase form, in one component.
 *
 * The form is revealed in place rather than in a modal: on a long sales page the
 * buyer has just read the pitch, and a dialog that covers it introduces a
 * moment of "wait, what was I buying?" at exactly the wrong step.
 */
export function BuyPanel({
  product,
  ctaLabel,
  id,
}: {
  product: Product
  /** Overridable so the mid-page CTA can repeat the offer in different words. */
  ctaLabel?: string
  id?: string
}) {
  const [state, formAction] = useFormState(requestPurchase, initial)
  const [open, setOpen] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Focus the first field when the form appears, so the keyboard opens on
  // mobile and the buyer is not left tapping around for the input.
  useEffect(() => {
    if (open) nameRef.current?.focus()
  }, [open])

  const off = discountPercent(product.price, product.compare_at_price)
  const price = formatPriceOrFree(product.price, product.currency)

  if (state.status === 'success') {
    return (
      <div
        id={id}
        className="scroll-mt-24 rounded-lg border-2 border-brand-cta/30 bg-brand-cream p-6"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-cta" aria-hidden />
          <div>
            <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
              Order received
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-brand-body">{state.message}</p>
            <p className="mt-3 flex items-start gap-2 text-sm text-brand-body/80">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Check your spam folder if it has not arrived within a few hours.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id={id} className="scroll-mt-24">
      {!open ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <span className="font-heading text-4xl font-bold leading-none text-brand-heading">
              {price}
            </span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <>
                <span className="font-heading text-xl text-brand-body/50 line-through">
                  {formatPriceOrFree(product.compare_at_price, product.currency)}
                </span>
                {off !== null && (
                  <span className="rounded-full bg-brand-cta px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-white">
                    Save {off}%
                  </span>
                )}
              </>
            )}
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 font-heading text-xs font-bold uppercase tracking-wider text-brand-body/70">
            <Download className="h-3.5 w-3.5" aria-hidden />
            {fileTypeLabel(product.file_type)}
            {formatFileSize(product.file_size_mb) && ` · ${formatFileSize(product.file_size_mb)}`}
            <span className="text-brand-body/40">·</span>
            One-time payment
          </p>

          <Button
            variant="cta"
            size="xl"
            className="mt-5 w-full"
            onClick={() => setOpen(true)}
          >
            {ctaLabel ?? 'Get instant access'} →
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-brand-body/70">
            <Lock className="h-3 w-3" aria-hidden />
            Secure order · Download link emailed to you
          </p>
        </>
      ) : (
        <form action={formAction} className="rounded-lg border-2 border-brand-tan bg-white p-5">
          <input type="hidden" name="productId" value={product.id} />

          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-4">
            <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
              Complete your order
            </p>
            <span className="font-heading text-2xl font-bold text-brand-cta">{price}</span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="buy-name">Your name</Label>
              <Input
                ref={nameRef}
                id="buy-name"
                name="name"
                required
                autoComplete="name"
                placeholder="Alex Morgan"
                className="mt-1.5"
                aria-describedby={state.fieldErrors?.name ? 'buy-name-error' : undefined}
              />
              <FieldError id="buy-name-error" message={state.fieldErrors?.name} />
            </div>

            <div>
              <Label htmlFor="buy-email">Email for delivery</Label>
              <Input
                id="buy-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="mt-1.5"
                aria-describedby={state.fieldErrors?.email ? 'buy-email-error' : 'buy-email-hint'}
              />
              <p id="buy-email-hint" className="mt-1 text-xs text-brand-body/70">
                Your download link goes here. Double-check it.
              </p>
              <FieldError id="buy-email-error" message={state.fieldErrors?.email} />
            </div>

            <div>
              <Label htmlFor="buy-note">Anything we should know? (optional)</Label>
              <Textarea
                id="buy-note"
                name="note"
                rows={2}
                maxLength={500}
                placeholder="Questions, or a format you'd prefer"
                className="mt-1.5"
              />
              <FieldError id="buy-note-error" message={state.fieldErrors?.note} />
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-md bg-brand-cream p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-cta" aria-hidden />
            <p className="text-xs leading-relaxed text-brand-body">
              We confirm payment and email your file by hand while automated checkout is being
              finished — usually within a few hours. Nothing is charged on this page.
            </p>
          </div>

          {state.status === 'error' && state.message && (
            <p
              className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {state.message}
            </p>
          )}

          <SubmitButton />

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full text-center font-heading text-xs font-bold uppercase tracking-wider text-brand-body/60 hover:text-brand-cta"
          >
            Back
          </button>
        </form>
      )}
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" className="mt-4 w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Placing order…' : 'Place my order'}
    </Button>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  )
}
