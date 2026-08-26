'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { updateRates, type SettingsState } from '@/actions/settings'
import { Card } from '@/components/admin/ui'
import { LocalTime } from '@/components/admin/local-time'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const initial: SettingsState = { status: 'idle' }

/** Prices the owner will recognise, so a wrong rate is obvious immediately. */
const SAMPLES = [15, 19, 24, 29, 49]

export function RateForm({
  usdToKes,
  kesRounding,
  geoEnabled,
  rateUpdatedAt,
}: {
  usdToKes: number
  kesRounding: number
  geoEnabled: boolean
  rateUpdatedAt: string
}) {
  const [state, formAction] = useFormState(updateRates, initial)
  const [rate, setRate] = useState(usdToKes)
  const [rounding, setRounding] = useState(kesRounding)

  // Mirrors convert() and price_in(): same multiply, same ceil to the step.
  const preview = (usd: number) =>
    rounding > 0 ? Math.ceil((usd * rate) / rounding) * rounding : Math.round(usd * rate)

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state.status === 'error' && state.message && (
        <p
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      {state.status === 'success' && state.message && (
        <p
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          role="status"
        >
          <Check className="h-4 w-4" aria-hidden />
          {state.message}
        </p>
      )}

      <Card className="p-5">
        <h2 className="text-lg">Exchange rate</h2>
        <p className="mt-1 text-sm text-brand-body">
          Set by you, not fetched live — a rate that moved mid-session could change the price
          between the product page and checkout.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="usd_to_kes">KES per 1 USD</Label>
            <Input
              id="usd_to_kes"
              name="usd_to_kes"
              type="number"
              step="0.0001"
              min="1"
              required
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-1.5"
            />
            {state.fieldErrors?.usd_to_kes && (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.usd_to_kes}</p>
            )}
            <p className="mt-1 text-xs text-brand-body/70">
              Last changed <LocalTime iso={rateUpdatedAt} />
            </p>
          </div>

          <div>
            <Label htmlFor="kes_rounding">Round KES up to</Label>
            <Input
              id="kes_rounding"
              name="kes_rounding"
              type="number"
              min="1"
              max="100"
              required
              value={rounding}
              onChange={(e) => setRounding(Number(e.target.value))}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-brand-body/70">
              Rounds up, so converting never leaves the shop short.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-border bg-brand-cream/40 p-4">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
            What buyers in Kenya would see
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {SAMPLES.map((usd) => (
              <li key={usd} className="flex justify-between gap-4 text-sm">
                <span className="text-brand-body">${usd.toFixed(2)}</span>
                <span className="font-heading font-bold text-brand-heading">
                  KSh {preview(usd).toLocaleString('en-KE')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg">Geographic pricing</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border border-border bg-white p-3">
          <input
            type="checkbox"
            name="geo_pricing_enabled"
            defaultChecked={geoEnabled}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#EB2437]"
          />
          <span className="text-sm text-brand-body">
            <span className="font-heading font-bold uppercase tracking-wide text-brand-heading">
              Show KES to visitors in Kenya
            </span>
            <br />
            Everyone else sees USD. Visitors can switch currency themselves from the footer, and
            their choice always wins over their location.
          </span>
        </label>
      </Card>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : 'Save settings'}
    </Button>
  )
}
