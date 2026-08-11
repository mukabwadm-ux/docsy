'use client'

import { useState, useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadPurchase } from '@/actions/account'

/**
 * Re-download for a purchase the buyer owns.
 *
 * The link is minted per click rather than rendered into the page. A signed URL
 * embedded in HTML would be copyable out of the markup and would keep working for
 * its whole lifetime — including from a shared screenshot or a cached page. This
 * way the URL only exists in the moment it is used, and every click is checked
 * against the order's owner and status server-side.
 */
export function DownloadButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function go() {
    setError(null)
    startTransition(async () => {
      const result = await downloadPurchase(orderId)
      if (result.status === 'error' || !result.url) {
        setError(result.message ?? 'Could not start the download.')
        return
      }
      // Same tab: this is a file response, so the browser downloads it and the
      // page stays where it is. A new tab would flash open and close.
      window.location.href = result.url
    })
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-cta px-5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-cta transition-colors hover:bg-brand-accent disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {pending ? 'Preparing…' : 'Download'}
      </button>
      {error && <p className="mt-1.5 max-w-[16rem] text-xs text-red-600">{error}</p>}
    </div>
  )
}
