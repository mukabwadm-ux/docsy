'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { ActionState } from '@/actions/admin'
import { cn } from '@/lib/utils'

/**
 * Runs a server action from a table row and surfaces the result inline.
 *
 * Wrapping the call in a transition, then router.refresh(), is what makes the
 * row reflect the new state. revalidatePath() inside the action invalidates the
 * server cache but does not tell this already-rendered client tree to re-fetch,
 * so without the refresh the admin clicks Approve and watches nothing happen.
 */
export function ActionButton({
  action,
  children,
  confirm,
  variant = 'default',
  className,
  onResult,
}: {
  action: () => Promise<ActionState>
  children: React.ReactNode
  /** When set, the click must be confirmed first. */
  confirm?: string
  variant?: 'default' | 'primary' | 'danger'
  className?: string
  onResult?: (state: ActionState) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const router = useRouter()

  function run() {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.status === 'error') {
        setError(result.message ?? 'Something went wrong.')
      } else {
        setArmed(false)
        router.refresh()
      }
      onResult?.(result)
    })
  }

  const styles = {
    default:
      'border-border bg-white text-brand-heading hover:border-brand-cta hover:text-brand-cta',
    primary: 'border-brand-cta bg-brand-cta text-white hover:bg-brand-accent',
    danger: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
  }[variant]

  // Two-step confirm rather than window.confirm(): a native dialog is blocked in
  // some embedded browsers, which would make destructive buttons silently no-op.
  if (confirm && armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-300 bg-red-600 px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {confirm}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="font-heading text-[11px] font-bold uppercase tracking-wide text-brand-body/60 hover:text-brand-heading"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => (confirm ? setArmed(true) : run())}
        disabled={pending}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-60',
          styles,
          className
        )}
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        {children}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  )
}
