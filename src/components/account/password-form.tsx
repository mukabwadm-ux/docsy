'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { setBuyerPassword, type AccountState } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const initial: AccountState = { status: 'idle' }

export function PasswordForm({ isFirstTime }: { isFirstTime: boolean }) {
  const [state, formAction] = useFormState(setBuyerPassword, initial)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          // "new-password" tells a password manager to offer a generated one
          // rather than autofilling the old value.
          autoComplete="new-password"
          autoFocus
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-brand-body/70">At least 8 characters.</p>
        {state.fieldErrors?.password && (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.password}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1.5"
        />
        {state.fieldErrors?.confirm && (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.confirm}</p>
        )}
      </div>

      {state.status === 'error' && state.message && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <SubmitButton isFirstTime={isFirstTime} />

      <p className="flex items-start gap-2 text-xs text-brand-body/70">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Docsy never emails passwords and never stores card details. Only you know this password.
      </p>
    </form>
  )
}

function SubmitButton({ isFirstTime }: { isFirstTime: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : isFirstTime ? 'Save and continue' : 'Update password'}
    </Button>
  )
}
