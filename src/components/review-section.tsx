import { BadgeCheck, Quote } from 'lucide-react'
import { ReviewForm } from '@/components/review-form'
import { StarRating } from '@/components/star-rating'
import { formatRelative } from '@/lib/format'
import type { Review } from '@/lib/types'

export function ReviewSection({
  productId,
  reviews,
  ratingAvg,
  ratingCount,
}: {
  productId: string
  reviews: Review[]
  ratingAvg: number
  ratingCount: number
}) {
  return (
    <section id="reviews" className="scroll-mt-24 border-t border-border py-14 lg:py-20">
      <div className="container">
        <div className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl">What buyers say</h2>
            {ratingCount > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="font-heading text-4xl font-bold leading-none text-brand-heading">
                  {ratingAvg.toFixed(1)}
                </span>
                <div>
                  <StarRating value={ratingAvg} size="md" />
                  <p className="mt-1 font-heading text-xs font-bold uppercase tracking-wide text-brand-body/70">
                    {ratingCount.toLocaleString('en-US')} {ratingCount === 1 ? 'review' : 'reviews'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-brand-body">
                No reviews yet — be the first to say something.
              </p>
            )}
          </div>

          <ReviewForm productId={productId} />
        </div>

        {reviews.length > 0 && (
          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="flex flex-col rounded-lg border border-border bg-white p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <StarRating value={r.rating} size="sm" />
                  <Quote className="h-4 w-4 shrink-0 text-brand-tan" aria-hidden />
                </div>

                {r.review_text && (
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-brand-body">
                    {r.review_text}
                  </p>
                )}

                <div className="mt-4 border-t border-border pt-3">
                  <p className="flex flex-wrap items-center gap-1.5 font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
                    {r.reviewer_name}
                    {r.is_verified_purchase && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-brand-cta"
                        title="Verified purchase"
                      >
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        Verified
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-body/70">
                    {r.reviewer_location ? `${r.reviewer_location} · ` : ''}
                    {formatRelative(r.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
