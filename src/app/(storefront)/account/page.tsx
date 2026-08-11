import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, FileText, PartyPopper } from 'lucide-react'
import { DownloadButton } from '@/components/account/download-button'
import { Button } from '@/components/ui/button'
import { requireBuyer } from '@/lib/buyer'
import { getPurchases } from '@/lib/account-data'
import { fileTypeLabel, formatFileSize, formatPrice, formatRelative } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Your purchases',
  robots: { index: false, follow: false },
}

export default async function AccountPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const session = await requireBuyer('/account')
  const purchases = await getPurchases(session.userId)

  return (
    <>
      {searchParams.welcome === '1' && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-brand-tan bg-brand-cream p-5">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-brand-cta" aria-hidden />
          <div>
            <p className="font-heading text-base font-bold uppercase tracking-wide text-brand-heading">
              You are all set
            </p>
            <p className="mt-1 text-sm text-brand-body">
              Your password is saved. Everything you buy shows up here, ready to download again
              whenever you need it.
            </p>
          </div>
        </div>
      )}

      <h2 className="text-xl">Your purchases</h2>

      {purchases.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-brand-cream/40 px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-brand-tan" aria-hidden />
          <p className="mt-4 font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
            Nothing here yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-brand-body">
            Anything you buy appears here permanently — you can re-download it any time, on any
            device.
          </p>
          <Button asChild variant="cta" size="md" className="mt-5">
            <Link href="/products">Browse the shop</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {purchases.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4 shadow-card sm:flex-row sm:items-center"
            >
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded border border-border bg-brand-cream">
                {p.product?.preview_image_url ? (
                  <Image
                    src={p.product.preview_image_url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <FileText className="h-5 w-5 text-brand-tan" aria-hidden />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {p.product ? (
                  <Link
                    href={`/products/${p.product.slug}`}
                    className="text-lg leading-snug text-brand-heading hover:text-brand-cta"
                  >
                    {p.product.title}
                  </Link>
                ) : (
                  <p className="text-lg text-brand-body">Product no longer available</p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body/70">
                  {fileTypeLabel(p.product?.file_type)}
                  {formatFileSize(p.product?.file_size_mb) &&
                    ` · ${formatFileSize(p.product?.file_size_mb)}`}
                  <span className="text-brand-body/40">·</span>
                  {formatPrice(p.amount, p.currency)}
                  <span className="text-brand-body/40">·</span>
                  {formatRelative(p.created_at)}
                </p>
              </div>

              <div className="shrink-0">
                {p.status === 'delivered' ? (
                  <DownloadButton orderId={p.id} />
                ) : (
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      <Clock className="h-3 w-3" aria-hidden />
                      Being prepared
                    </span>
                    {p.checkout_token && (
                      <Link
                        href={`/checkout/${p.checkout_token}`}
                        className="mt-1.5 block text-right font-heading text-[11px] font-bold uppercase tracking-wider text-brand-cta hover:underline"
                      >
                        View order
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
