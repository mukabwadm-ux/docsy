'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { updateBuyerProfile, type AccountState } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const initial: AccountState = { status: 'idle' }

export function SettingsForm({
  fullName,
  email,
  marketingOptIn,
}: {
  fullName: string
  email: string
  marketingOptIn: boolean
}) {
  const [state, formAction] = useFormState(updateBuyerProfile, initial)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="full_name">Your name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          maxLength={80}
          placeholder="Alex Morgan"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="email-display">Email</Label>
        <Input id="email-display" value={email} readOnly disabled className="mt-1.5 bg-brand-cream/40" />
        <p className="mt-1.5 text-xs text-brand-body/70">
          Your purchases are tied to this address, so it cannot be changed here — reply to any Docsy
          email and we will move them for you.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-brand-cream/40 p-3">
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={marketingOptIn}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#EB2437]"
        />
        <span className="text-sm text-brand-body">
          <span className="font-heading font-bold uppercase tracking-wide text-brand-heading">
            Campaign emails
          </span>
          <br />
          New products and occasional offers. Receipts and download links always arrive regardless —
          those are part of what you bought.
        </span>
      </label>

      {state.status === 'error' && state.message && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <p className="flex items-center gap-2 text-sm text-green-700" role="status">
          <Check className="h-4 w-4" aria-hidden />
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
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}
