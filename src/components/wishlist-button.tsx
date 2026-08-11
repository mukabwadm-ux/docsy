'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Loader2 } from 'lucide-react'
import { toggleWishlist } from '@/actions/account'
import { cn } from '@/lib/utils'

/**
 * Save-for-later toggle.
 *
 * Optimistic: the heart fills on click and only reverts if the server disagrees.
 * A save that waits for a round trip before showing anything reads as a dead
 * button, and this one sits on a card the visitor may be clicking through.
 *
 * A signed-out visitor is sent to sign in with a `next` back to where they were,
 * rather than being told to sign in and losing their place.
 */
export function WishlistButton({
  productId,
  saved = false,
  variant = 'icon',
  returnTo,
}: {
  productId: string
  saved?: boolean
  variant?: 'icon' | 'full'
  returnTo?: string
}) {
  const router = useRouter()
  const [actual, setActual] = useState(saved)
  const [optimistic, setOptimistic] = useOptimistic(actual)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(e: React.MouseEvent) {
    // The icon variant sits inside a product-card link.
    e.preventDefault()
    e.stopPropagation()
    setError(null)

    startTransition(async () => {
      setOptimistic(!actual)
      const result = await toggleWishlist(productId)

      if (result.status === 'error') {
        if (result.message?.includes('Sign in')) {
          const next = returnTo ?? window.location.pathname
          router.push(`/account/login?next=${encodeURIComponent(next)}`)
          return
        }
        setError(result.message ?? 'Could not save.')
        return
      }
      setActual(result.message === 'saved')
      router.refresh()
    })
  }

  const isSaved = optimistic

  if (variant === 'full') {
    return (
      <div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={isSaved}
          className={cn(
            'inline-flex h-12 items-center gap-2 rounded-md border-2 px-5 font-heading text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-70',
            isSaved
              ? 'border-brand-cta bg-brand-cta/5 text-brand-cta'
              : 'border-brand-heading/20 text-brand-heading hover:border-brand-cta hover:text-brand-cta'
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} aria-hidden />
          )}
          {isSaved ? 'Saved' : 'Save for later'}
        </button>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
      title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={cn(
        'absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition-colors',
        isSaved
          ? 'border-brand-cta bg-white text-brand-cta'
          : 'border-white/70 bg-white/85 text-brand-body/70 hover:text-brand-cta'
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} aria-hidden />
      )}
    </button>
  )
}
