'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { startPayment, type PaymentState } from '@/actions/payment'
import { Button } from '@/components/ui/button'

const initial: PaymentState = { status: 'idle' }

/**
 * Sends the buyer to Paystack's hosted page.
 *
 * A plain form posting to a server action, not a client-side SDK. The amount and
 * the currency are read from the order server-side, so there is nothing here for
 * a devtools console to change — and no card field on this page means no card
 * data ever touches Docsy.
 */
export function PayButton({
  token,
  amountLabel,
  currency,
}: {
  token: string
  amountLabel: string
  currency: string
}) {
  const [state, formAction] = useFormState(startPayment, initial)

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />

      <SubmitButton amountLabel={amountLabel} />

      <ul className="mt-4 space-y-1.5">
        <li className="flex items-center gap-2 text-xs text-brand-body/80">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-cta" aria-hidden />
          {currency === 'KES'
            ? 'Pay with M-Pesa, card or bank transfer.'
            : 'Pay by card. Apple Pay and Google Pay where available.'}
        </li>
        <li className="flex items-center gap-2 text-xs text-brand-body/80">
          <Lock className="h-3.5 w-3.5 shrink-0 text-brand-cta" aria-hidden />
          Handled by Paystack. Docsy never sees or stores your card details.
        </li>
      </ul>

      {state.status === 'error' && state.message && (
        <p
          className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
    </form>
  )
}

function SubmitButton({ amountLabel }: { amountLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="xl" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {pending ? 'Taking you to payment…' : `Pay ${amountLabel}`}
    </Button>
  )
}
