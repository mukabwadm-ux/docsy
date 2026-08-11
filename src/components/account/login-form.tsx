'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { buyerSignIn, requestAccessLink, type AccountState } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const initial: AccountState = { status: 'idle' }

/**
 * Two ways in, one form.
 *
 * Password for people who have set one, and an emailed link for everyone else —
 * which doubles as the forgot-password path and as the way an account created
 * during checkout gets opened for the first time. Keeping both here means nobody
 * has to work out which flow they are in.
 */
export function AccountLoginForm({ next, linkError }: { next?: string; linkError?: string }) {
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [signInState, signInAction] = useFormState(buyerSignIn, initial)
  const [linkState, linkAction] = useFormState(requestAccessLink, initial)

  if (linkState.status === 'success') {
    return (
      <div className="rounded-lg border border-brand-tan bg-brand-cream p-6" role="status">
        <CheckCircle2 className="h-6 w-6 text-brand-cta" aria-hidden />
        <p className="mt-3 font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
          Check your email
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-brand-body">{linkState.message}</p>
        <p className="mt-3 text-sm text-brand-body/70">
          The link works once and expires. Look in spam if it has not arrived in a few minutes.
        </p>
      </div>
    )
  }

  return (
    <div>
      {linkError && (
        <p
          className="mb-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {linkError === 'link-expired'
            ? 'That sign-in link has expired or was already used. Request a new one below.'
            : linkError}
        </p>
      )}

      {mode === 'password' ? (
        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? '/account'} />
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

          {signInState.status === 'error' && signInState.message && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {signInState.message}
            </p>
          )}

          <SubmitButton label="Sign in" pendingLabel="Signing in…" />

          <button
            type="button"
            onClick={() => setMode('link')}
            className="w-full text-center font-heading text-xs font-bold uppercase tracking-wider text-brand-body/70 hover:text-brand-cta"
          >
            Email me a sign-in link instead
          </button>
        </form>
      ) : (
        <form action={linkAction} className="space-y-4">
          <div>
            <Label htmlFor="link-email">Email</Label>
            <Input
              id="link-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="mt-1.5"
            />
            {linkState.fieldErrors?.email && (
              <p className="mt-1.5 text-xs text-red-600">{linkState.fieldErrors.email}</p>
            )}
            <p className="mt-1.5 text-xs text-brand-body/70">
              We send a single-use link. No password needed — you can set one once you are in.
            </p>
          </div>

          {linkState.status === 'error' && linkState.message && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {linkState.message}
            </p>
          )}

          <SubmitButton label="Send me a link" pendingLabel="Sending…" icon />

          <button
            type="button"
            onClick={() => setMode('password')}
            className="w-full text-center font-heading text-xs font-bold uppercase tracking-wider text-brand-body/70 hover:text-brand-cta"
          >
            Use a password instead
          </button>
        </form>
      )}

      <p className="mt-6 border-t border-border pt-5 text-sm text-brand-body">
        No account yet? One is created for you the first time you buy something —{' '}
        <Link href="/products" className="text-brand-cta underline underline-offset-4">
          browse the shop
        </Link>
        .
      </p>
    </div>
  )
}

function SubmitButton({
  label,
  pendingLabel,
  icon = false,
}: {
  label: string
  pendingLabel: string
  icon?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        icon && <Mail className="h-4 w-4" aria-hidden />
      )}
      {pending ? pendingLabel : label}
    </Button>
  )
}
