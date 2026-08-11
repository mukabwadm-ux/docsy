import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const

/**
 * Renders a 0–5 rating with half-star precision.
 *
 * The partial star is done by clipping a filled row over an empty one rather
 * than by rounding, because rounding 4.4 up to 4.5 is a claim about the product
 * that the data does not support.
 */
export function StarRating({
  value,
  count,
  size = 'md',
  className,
}: {
  value: number
  count?: number
  size?: keyof typeof SIZES
  className?: string
}) {
  const clamped = Math.max(0, Math.min(5, value))
  const percent = (clamped / 5) * 100

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="relative inline-flex"
        role="img"
        aria-label={`${clamped.toFixed(1)} out of 5 stars`}
      >
        <span className="inline-flex text-[#d9d3c4]">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={SIZES[size]} fill="currentColor" strokeWidth={0} aria-hidden />
          ))}
        </span>
        <span
          className="absolute inset-0 inline-flex overflow-hidden text-brand-cta"
          style={{ width: `${percent}%` }}
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className={cn(SIZES[size], 'shrink-0')}
              fill="currentColor"
              strokeWidth={0}
            />
          ))}
        </span>
      </span>
      {count !== undefined && (
        <span className="font-heading text-xs font-bold uppercase tracking-wide text-brand-body">
          {count > 0 ? `${count.toLocaleString('en-US')} review${count === 1 ? '' : 's'}` : 'No reviews yet'}
        </span>
      )}
    </span>
  )
}
