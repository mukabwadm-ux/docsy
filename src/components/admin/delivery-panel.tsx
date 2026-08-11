'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Link2, Loader2, Mail, Send } from 'lucide-react'
import { getDeliveryLink, sendOrderFile, setOrderDelivered } from '@/actions/admin'

/**
 * Fulfilment controls for one order.
 *
 * Two paths, depending on whether transactional email is configured:
 *
 *  - Automatic: one button mints the link, emails it and marks the order
 *    delivered. Sending happens before the status changes, so a failed send
 *    leaves the order in the queue rather than silently marking it done.
 *  - Manual: mint a link, copy it, open a pre-filled mail client, mark it sent.
 *    Generating a link and marking delivered stay separate here, because the
 *    admin needs the link before they can send anything.
 *
 * The manual controls remain available even when email works — a buyer whose
 * address bounces still needs a link that can be pasted somewhere else.
 */
export function DeliveryPanel({
  orderId,
  buyerEmail,
  buyerName,
  productTitle,
  delivered,
  emailConfigured,
  emailHint,
}: {
  orderId: string
  buyerEmail: string
  buyerName: string | null
  productTitle: string
  delivered: boolean
  emailConfigured: boolean
  emailHint: string
}) {
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showManual, setShowManual] = useState(!emailConfigured)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function sendAutomatically() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await sendOrderFile(orderId)
      if (result.status === 'error') setError(result.message ?? 'Could not send.')
      else {
        setNotice(result.message ?? 'Sent.')
        router.refresh()
      }
    })
  }

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
        {emailConfigured && !delivered && (
          <button
            type="button"
            onClick={sendAutomatically}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-cta bg-brand-cta px-3 font-heading text-[11px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-accent disabled:opacity-60"
            title={`Email the file to ${buyerEmail} and mark this delivered`}
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3 w-3" aria-hidden />
            )}
            Send file
          </button>
        )}

        {emailConfigured && delivered && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-green-800">
            <Check className="h-3 w-3" aria-hidden />
            Sent
          </span>
        )}

        {!showManual ? (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/60 hover:text-brand-cta"
          >
            Manual
          </button>
        ) : (
          <>
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-heading hover:border-brand-cta hover:text-brand-cta"
                >
                  <Mail className="h-3 w-3" aria-hidden />
                  Mail app
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
          </>
        )}
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

      {notice && <p className="text-right text-[11px] text-green-700">{notice}</p>}
      {error && <p className="max-w-xs text-right text-[11px] text-red-600">{error}</p>}

      {!emailConfigured && !delivered && (
        <p className="max-w-xs text-right text-[10px] leading-snug text-brand-body/50">{emailHint}</p>
      )}
    </div>
  )
}
