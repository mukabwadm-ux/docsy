'use client'

import { useEffect, useState } from 'react'

/**
 * An exact timestamp in the *viewer's* timezone.
 *
 * This has to happen in the browser. Vercel's runtime is UTC, so a
 * server-rendered clock time would read three hours behind for an admin in
 * Nairobi — and a timestamp that is silently wrong is worse than one that is
 * missing, because nothing about "6:05 PM" looks incorrect.
 *
 * Nothing renders until the effect runs, deliberately: the alternative is
 * painting a UTC time and correcting it a moment later, which means the wrong
 * time is briefly on screen and looks authoritative. The caller pairs this with
 * a server-rendered relative time ("5 hours ago"), which is timezone-agnostic,
 * so the cell is never empty and still works with JavaScript disabled.
 */
export function LocalTime({
  iso,
  withDate = true,
  className,
}: {
  iso: string
  /** Drop the date when the surrounding row already establishes the day. */
  withDate?: boolean
  className?: string
}) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return

    setText(
      d.toLocaleString(undefined, {
        ...(withDate ? { month: 'short', day: 'numeric' } : {}),
        hour: 'numeric',
        minute: '2-digit',
      })
    )
  }, [iso, withDate])

  return (
    <time
      dateTime={iso}
      // Full timestamp with timezone name on hover, for anything that needs to
      // be reconciled against a bank statement or a support email.
      title={new Date(iso).toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'long',
      })}
      className={className}
      suppressHydrationWarning
    >
      {text}
    </time>
  )
}
