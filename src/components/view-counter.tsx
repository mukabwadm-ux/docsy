'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Fire-and-forget view increment.
 *
 * Runs from the browser rather than in the page body because the product page
 * is statically rendered with ISR — a server-side increment would only fire when
 * the cache regenerated, undercounting by however many visitors were served the
 * cached copy.
 *
 * The ref guard matters in development, where React's StrictMode mounts effects
 * twice and would otherwise double every view.
 */
export function ViewCounter({ productId }: { productId: string }) {
  const counted = useRef(false)

  useEffect(() => {
    if (counted.current) return
    counted.current = true

    createClient()
      .rpc('increment_product_views', { p_product_id: productId })
      // A failed view count is not worth a console error in front of a buyer.
      .then(() => undefined)
  }, [productId])

  return null
}
