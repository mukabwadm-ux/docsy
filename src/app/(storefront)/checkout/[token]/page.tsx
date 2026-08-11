import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  Mail,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fileTypeLabel, formatFileSize, formatPriceOrFree, formatRelative } from '@/lib/format'
import { getCheckout } from '@/lib/checkout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your order',
  // A checkout URL is a private link to one person's order. It must never be
  // indexed, and referrers must not carry the token to third parties.
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

/**
 * One screen. Order summary, what happens next, and the single action available.
 *
 * The page is addressed by an unguessable token rather than an account, so a
 * buyer can close the tab, lose their phone, or come back tomorrow and land back
 * on the same order — without Docsy holding a password or a card. When a gateway
 * is wired up, the payment step mounts here and nothing else about the flow
 * changes.
 */
export default async function CheckoutPage({ params }: { params: { token: string } }) {
  const checkout = await getCheckout(params.token)
  if (!checkout) notFound()

  const { order, product, expired } = checkout
  const delivered = order.status === 'delivered'
  const cover = product?.preview_image_url ?? null

  return (
    <div className="container max-w-3xl py-10 lg:py-14">
      <ol className="flex items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-widest text-brand-body/60">
        <li className="text-brand-heading">1. Your details</li>
        <ArrowRight className="h-3 w-3" aria-hidden />
        <li className={delivered ? 'text-brand-body/60' : 'text-brand-cta'}>2. Payment</li>
        <ArrowRight className="h-3 w-3" aria-hidden />
        <li className={delivered ? 'text-brand-cta' : ''}>3. Download</li>
      </ol>

      <h1 className="mt-4 text-3xl sm:text-4xl">
        {delivered ? 'Your file is on its way' : 'Confirm your order'}
      </h1>

      {/* ------------------------------------------------------- summary */}
      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-white shadow-card">
        <div className="flex gap-4 p-5">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded border border-border bg-brand-cream">
            {cover ? (
              <Image src={cover} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center">
                <FileText className="h-6 w-6 text-brand-tan" aria-hidden />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {product ? (
              <Link
                href={`/products/${product.slug}`}
                className="text-lg leading-snug text-brand-heading hover:text-brand-cta"
              >
                {product.title}
              </Link>
            ) : (
              <p className="text-lg text-brand-body">This product is no longer available</p>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/70">
              <Download className="h-3.5 w-3.5" aria-hidden />
              {fileTypeLabel(product?.file_type)}
              {formatFileSize(product?.file_size_mb) && ` · ${formatFileSize(product?.file_size_mb)}`}
            </p>
            <p className="mt-2 text-xs text-brand-body/70">
              Ordered {formatRelative(order.created_at)}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-heading text-2xl font-bold leading-none text-brand-heading">
              {formatPriceOrFree(order.amount ?? 0, order.currency)}
            </p>
            <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body/60">
              One-time
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-brand-cream/40 px-5 py-3">
          <span className="flex items-center gap-2 text-sm text-brand-body">
            <Mail className="h-4 w-4 text-brand-body/60" aria-hidden />
            Delivering to <strong className="font-medium text-brand-heading">{order.buyer_email}</strong>
          </span>
          {product && (
            <Link
              href={`/products/${product.slug}`}
              className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-cta hover:underline"
            >
              Wrong email? Start again
            </Link>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- state */}
      {delivered ? (
        <div className="mt-6 rounded-lg border-2 border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-700" aria-hidden />
            <div>
              <p className="font-heading text-lg font-bold uppercase tracking-wide text-green-900">
                Sent to your inbox
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-green-900/80">
                We emailed your download link to {order.buyer_email}
                {order.delivered_at ? ` ${formatRelative(order.delivered_at)}` : ''}. The link works
                for 7 days — save the file somewhere safe once you have it.
              </p>
              <p className="mt-3 text-sm text-green-900/70">
                Nothing arrived? Check your spam folder, then reply to any Docsy email and we will
                resend it.
              </p>
            </div>
          </div>
        </div>
      ) : expired ? (
        <div className="mt-6 rounded-lg border border-brand-tan bg-brand-cream p-6">
          <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
            This checkout has expired
          </p>
          <p className="mt-1.5 text-[15px] text-brand-body">
            Checkout links last 30 days. Nothing was charged — start again and it takes a moment.
          </p>
          {product && (
            <Button asChild variant="cta" size="lg" className="mt-5">
              <Link href={`/products/${product.slug}`}>Back to the product</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-lg border-2 border-brand-cta/25 bg-brand-cream p-6">
            <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
              What happens next
            </p>
            <ol className="mt-3 space-y-2.5">
              {[
                'We confirm your payment — you will hear from us with how to pay, if you have not already.',
                'Your download link is emailed to you, usually within a few hours.',
                'The link works for 7 days, and the file is yours to keep for good.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-brand-body">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-cta font-heading text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <p className="mt-5 flex items-start gap-2 border-t border-brand-tan pt-4 text-sm text-brand-body/80">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Nothing is charged on this page, and we never ask for or store card details here.
            </p>
          </div>

          {/* This link is the resume point. Saying so is what makes an
              interrupted checkout recoverable by the buyer rather than lost. */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-white p-5">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-brand-cta" aria-hidden />
            <p className="text-sm leading-relaxed text-brand-body">
              <strong className="font-medium text-brand-heading">Keep this page.</strong> Bookmark it
              and you can come back to this exact order at any time in the next 30 days — nothing to
              re-enter, and no risk of being charged twice.
            </p>
          </div>
        </>
      )}

      {/* -------------------------------------------------------- trust */}
      <ul className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6">
        {[
          { icon: Download, label: 'Instant\ndownload' },
          { icon: BadgeCheck, label: 'Yours\nto keep' },
          { icon: Clock, label: 'Free\nupdates' },
        ].map(({ icon: Icon, label }) => (
          <li key={label} className="flex flex-col items-center gap-2 text-center">
            <Icon className="h-5 w-5 text-brand-heading" strokeWidth={1.75} aria-hidden />
            <span className="whitespace-pre-line text-xs leading-tight text-brand-body">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
