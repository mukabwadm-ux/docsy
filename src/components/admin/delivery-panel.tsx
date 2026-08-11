'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Link2, Loader2, Mail } from 'lucide-react'
import { getDeliveryLink, setOrderDelivered } from '@/actions/admin'

/**
 * The fulfilment control for one order: mint a link, copy it, open a pre-filled
 * email, mark it delivered.
 *
 * Generating the link and marking the order delivered are separate, deliberate
 * steps. The admin needs the link before they can send anything, so auto-marking
 * on generation would flag orders as fulfilled that were never emailed.
 */
export function DeliveryPanel({
  orderId,
  buyerEmail,
  buyerName,
  productTitle,
  delivered,
}: {
  orderId: string
  buyerEmail: string
  buyerName: string | null
  productTitle: string
  delivered: boolean
}) {
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await getDeliveryLink(orderId)
      if (result.status === 'error' || !result.url) {
        setError(result.message ?? 'Could not create the link.')
        return
      }
      setLink(result.url)
    })
  }

  function toggleDelivered() {
    startTransition(async () => {
      const result = await setOrderDelivered(orderId, !delivered)
      if (result.status === 'error') setError(result.message ?? 'Could not update.')
      else router.refresh()
    })
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is denied outside a secure context; the input below is
      // selectable so the link is still recoverable by hand.
      setError('Could not copy automatically — select the link and copy it.')
    }
  }

  const mailto = `mailto:${encodeURIComponent(buyerEmail)}?subject=${encodeURIComponent(
    `Your download: ${productTitle}`
  )}&body=${encodeURIComponent(
    `Hi ${buyerName?.split(' ')[0] ?? 'there'},\n\n` +
      `Thanks for your order. Here is your download link for ${productTitle}:\n\n` +
      `${link ?? '[generate the link first]'}\n\n` +
      `The link works for 7 days. Save the file somewhere safe once you have it.\n\n` +
      `If anything is wrong with it, just reply to this email.\n\nThanks,\nDocsy`
  )}`

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Link2 className="h-3 w-3" aria-hidden />
          )}
          {link ? 'New link' : 'Get link'}
        </button>

        {link && (
          <>
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-heading hover:border-brand-cta hover:text-brand-cta"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" aria-hidden />
              ) : (
                <Copy className="h-3 w-3" aria-hidden />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <a
              href={mailto}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-cta bg-brand-cta px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-white hover:bg-brand-accent"
            >
              <Mail className="h-3 w-3" aria-hidden />
              Email it
            </a>
          </>
        )}

        <button
          type="button"
          onClick={toggleDelivered}
          disabled={pending}
          className={
            delivered
              ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-body/70 hover:text-brand-heading disabled:opacity-60'
              : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-green-300 bg-green-600 px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-white hover:bg-green-700 disabled:opacity-60'
          }
        >
          <Check className="h-3 w-3" aria-hidden />
          {delivered ? 'Undo' : 'Mark sent'}
        </button>
      </div>

      {link && (
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full max-w-xs rounded border border-border bg-brand-cream/50 px-2 py-1 text-[11px] text-brand-body"
          aria-label="Download link"
        />
      )}

      {error && <p className="max-w-xs text-right text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
