'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, ChevronDown, Download, Loader2, Lock, Zap } from 'lucide-react'
import { requestPurchase, type PurchaseState } from '@/actions/purchase'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { discountPercent, fileTypeLabel, formatFileSize, formatPriceOrFree } from '@/lib/format'
import type { Product } from '@/lib/types'

const initial: PurchaseState = { status: 'idle' }

/**
 * Express checkout: price, one email field, one button.
 *
 * There is no reveal step and no required name. A digital download needs exactly
 * one thing to be deliverable — an address to send it to — so anything else is a
 * box between the buyer and the file. Name and note are still accepted, behind a
 * disclosure, for the minority who want to say something.
 *
 * The form posts directly rather than opening a modal: on a long sales page the
 * buyer has just finished reading the pitch, and a dialog that covers it
 * introduces a "wait, what was I buying?" beat at precisely the wrong moment.
 */
export function BuyPanel({
  product,
  ctaLabel,
  id,
}: {
  product: Product
  ctaLabel?: string
  id?: string
}) {
  const [state, formAction] = useFormState(requestPurchase, initial)
  const [showExtras, setShowExtras] = useState(false)

  const off = discountPercent(product.price, product.compare_at_price)
  const price = formatPriceOrFree(product.price, product.currency)

  return (
    <div id={id} className="scroll-mt-24">
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

      <form action={formAction} className="mt-5">
        <input type="hidden" name="productId" value={product.id} />

        {/* Email and CTA share a row from sm up, so the whole purchase reads as a
            single action rather than a form to be filled in. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="buy-email" className="sr-only">
              Email address for delivery
            </label>
            <Input
              id="buy-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              enterKeyHint="go"
              placeholder="you@example.com"
              className="h-14 text-base"
              aria-describedby={state.fieldErrors?.email ? 'buy-email-error' : undefined}
            />
          </div>
          <SubmitButton label={ctaLabel ?? 'Get instant access'} />
        </div>

        {state.fieldErrors?.email && (
          <p id="buy-email-error" className="mt-1.5 text-xs text-red-600">
            {state.fieldErrors.email}
          </p>
        )}

        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-brand-body/70">
          <Zap className="h-3 w-3 text-brand-cta" aria-hidden />
          Your download link is emailed to this address. No account needed.
        </p>

        {!showExtras ? (
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="mt-3 inline-flex items-center gap-1 font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/60 transition-colors hover:text-brand-cta"
          >
            <ChevronDown className="h-3 w-3" aria-hidden />
            Add your name or a note
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-brand-cream/40 p-4">
            <div>
              <Label htmlFor="buy-name">Your name (optional)</Label>
              <Input
                id="buy-name"
                name="name"
                autoComplete="name"
                placeholder="Alex Morgan"
                className="mt-1.5"
              />
              {state.fieldErrors?.name && (
                <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p>
              )}
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
              {state.fieldErrors?.note && (
                <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.note}</p>
              )}
            </div>
          </div>
        )}

        {state.status === 'error' && state.message && (
          <p
            className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {state.message}
          </p>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-body/70">
          <Lock className="h-3 w-3" aria-hidden />
          Takes you to a one-page order summary. Nothing is charged yet, and we never store card
          details.
        </p>
      </form>
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="cta"
      size="lg"
      className="h-14 shrink-0 px-7 text-base sm:w-auto"
      disabled={pending}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'One moment…' : `${label} →`}
    </Button>
  )
}
