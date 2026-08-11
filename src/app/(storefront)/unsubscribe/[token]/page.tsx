import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { unsubscribeByToken } from '@/actions/account'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } }

/**
 * One click, no sign-in, no confirmation step.
 *
 * Anything that stands between an unsubscribe link and being unsubscribed gets
 * reported as spam instead, which costs far more than the campaign was worth.
 */
export default async function UnsubscribePage({ params }: { params: { token: string } }) {
  const ok = await unsubscribeByToken(params.token)

  return (
    <div className="container flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-14 text-center">
      {ok ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-brand-cta" aria-hidden />
          <h1 className="mt-4 text-2xl">You are unsubscribed</h1>
          <p className="mt-3 text-brand-body">
            You will not get any more campaign emails from Docsy. Receipts and download links for
            anything you buy will still arrive — those are part of the purchase.
          </p>
        </>
      ) : (
        <>
          <XCircle className="h-10 w-10 text-brand-body/40" aria-hidden />
          <h1 className="mt-4 text-2xl">That link did not work</h1>
          <p className="mt-3 text-brand-body">
            It may already have been used. You can also turn campaign emails off in your account
            settings.
          </p>
        </>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" size="md">
          <Link href="/account/settings">Account settings</Link>
        </Button>
        <Button asChild variant="ghost" size="md">
          <Link href="/">Back to Docsy</Link>
        </Button>
      </div>
    </div>
  )
}
