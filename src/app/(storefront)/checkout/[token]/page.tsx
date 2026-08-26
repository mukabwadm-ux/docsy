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
import { PayButton } from '@/components/pay-button'
import { Button } from '@/components/ui/button'
import { confirmPayment } from '@/actions/payment'
import { getCheckout } from '@/lib/checkout'
import { fileTypeLabel, formatFileSize, formatPrice, formatRelative } from '@/lib/format'
import { isPaystackConfigured } from '@/lib/paystack'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your order',
  // A checkout URL is a private link to one buyer's order. It must never be
  // indexed, and referrers must not carry the token to third parties.
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

/**
 * One screen: summary, payment, then the download.
 *
 * Addressed by an unguessable token rather than an account, so the buyer can close
 * the tab, lose their phone or come back tomorrow and land on the same order —
 * without Docsy holding a password or a card.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { verify?: string }
}) {
  /**
   * Confirm before loading, when Paystack has just redirected back.
   *
   * The webhook is the authoritative path and may already have settled this.
   * Doing it here too means the buyer who does return sees their download
   * immediately rather than waiting on a webhook they cannot observe.
   * fulfilPaidOrder is safe to call twice, so the two racing does no harm.
   */
  if (searchParams.verify === '1') {
    await confirmPayment(params.token).catch(() => undefined)
  }

  const checkout = await getCheckout(params.token)
  if (!checkout) notFound()

  const { order, product, expired } = checkout
  const paid = order.paymentStatus === 'paid'
  const delivered = order.status === 'delivered'
  const cover = product?.preview_image_url ?? null
  const amountLabel = formatPrice(order.amount ?? 0, order.currency)
  const canPay = isPaystackConfigured() && !paid && !expired && Number(order.amount ?? 0) > 0

  return (
    <div className="container max-w-3xl py-10 lg:py-14">
      <ol className="flex items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-widest text-brand-body/60">
        <li className={paid ? 'text-brand-body/60' : 'text-brand-heading'}>1. Your details</li>
        <ArrowRight className="h-3 w-3" aria-hidden />
        <li className={paid ? 'text-brand-body/60' : 'text-brand-cta'}>2. Payment</li>
        <ArrowRight className="h-3 w-3" aria-hidden />
        <li className={paid ? 'text-brand-cta' : ''}>3. Download</li>
      </ol>

      <h1 className="mt-4 text-3xl sm:text-4xl">
        {delivered ? 'Your file is on its way' : paid ? 'Payment received' : 'Complete your order'}
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
              {formatFileSize(product?.file_size_mb) &&
                ` · ${formatFileSize(product?.file_size_mb)}`}
            </p>
            <p className="mt-2 text-xs text-brand-body/70">
              Ordered {formatRelative(order.created_at)}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {/* The charged amount, in the currency the buyer was shown. Not
                converted again here — this is the figure they agreed to. */}
            <p className="font-heading text-2xl font-bold leading-none text-brand-heading">
              {amountLabel}
            </p>
            <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body/60">
              One-time
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-brand-cream/40 px-5 py-3">
          <span className="flex items-center gap-2 text-sm text-brand-body">
            <Mail className="h-4 w-4 text-brand-body/60" aria-hidden />
            Delivering to{' '}
            <strong className="font-medium text-brand-heading">{order.buyer_email}</strong>
          </span>
          {product && !paid && (
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
      {paid ? (
        <div className="mt-6 rounded-lg border-2 border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-700" aria-hidden />
            <div>
              <p className="font-heading text-lg font-bold uppercase tracking-wide text-green-900">
                {delivered ? 'Sent to your inbox' : 'Payment received'}
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-green-900/80">
                {delivered
                  ? `We emailed your download link to ${order.buyer_email}. The link works for 7 days — save the file somewhere safe once you have it.`
                  : `Thank you. Your payment is confirmed and your download link is on its way to ${order.buyer_email}.`}
              </p>
              {order.paymentReference && (
                <p className="mt-3 font-heading text-[11px] font-bold uppercase tracking-wider text-green-900/60">
                  Reference {order.paymentReference}
                </p>
              )}
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
      ) : canPay ? (
        <>
          <div className="mt-6 rounded-lg border-2 border-brand-cta/25 bg-brand-cream p-6">
            <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
              Pay and download
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-brand-body">
              Your download link is emailed the moment payment clears — usually within seconds.
            </p>
            <div className="mt-5">
              <PayButton token={params.token} amountLabel={amountLabel} currency={order.currency} />
            </div>
          </div>

          {/* The resume point. Saying so is what makes an interrupted checkout
              recoverable by the buyer rather than lost. */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-white p-5">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-brand-cta" aria-hidden />
            <p className="text-sm leading-relaxed text-brand-body">
              <strong className="font-medium text-brand-heading">Keep this page.</strong> Bookmark
              it and you can come back to this exact order at any time in the next 30 days —
              nothing to re-enter, and no risk of paying twice.
            </p>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg border-2 border-brand-cta/25 bg-brand-cream p-6">
          <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
            What happens next
          </p>
          <ol className="mt-3 space-y-2.5">
            {[
              'We confirm your payment and email you with how to pay, if you have not already arranged it.',
              'Your download link follows, usually within a few hours.',
              'The link works for 7 days, and the file is yours to keep for good.',
            ].map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-[15px] leading-relaxed text-brand-body"
              >
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
            <span className="whitespace-pre-line text-xs leading-tight text-brand-body">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
