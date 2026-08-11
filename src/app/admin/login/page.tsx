'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, FileText, Loader2 } from 'lucide-react'
import { signIn, type LoginState } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const initial: LoginState = { status: 'idle' }

export default function AdminLoginPage() {
  const [state, formAction] = useFormState(signIn, initial)

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-cta text-white">
            <FileText className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="font-heading text-2xl font-bold uppercase tracking-tight text-brand-heading">
            Docsy
          </span>
        </div>

        <form
          action={formAction}
          className="mt-8 rounded-lg border border-brand-tan bg-white p-6 shadow-card"
        >
          <h1 className="text-xl">Admin sign in</h1>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5"
              />
            </div>
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
        </form>

        <p className="mt-4 text-center text-xs text-brand-body/70">
          Access is granted with{' '}
          <code className="rounded bg-white px-1 py-0.5">npm run admin:grant</code>
        </p>
      </div>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" className="mt-6 w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  )
}
