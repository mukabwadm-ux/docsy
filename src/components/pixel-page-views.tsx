'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Re-fires the Meta pixel's PageView when the route changes.
 *
 * The snippet Meta hands out tracks one PageView as it loads, which is correct for
 * a site that reloads on every link. This one does not: the App Router swaps the
 * page client-side, so without this a visitor who lands on the homepage and browses
 * four products is one PageView to Meta. That understates traffic and, worse,
 * starves the algorithm of the signal it optimises ads against.
 *
 * Only `usePathname` is read, never `useSearchParams`. The latter forces any static
 * route that mounts it into a Suspense boundary and deopts it into dynamic
 * rendering, which would quietly undo the storefront's prerendering — the exact
 * regression documented in CLAUDE.md. It also means a filter change on the catalog
 * (`?category=ebooks`) is not counted as a new page, which is the right call: it is
 * the same page with a different view.
 */
export function PixelPageViews() {
  const pathname = usePathname()
  const firstRender = useRef(true)

  useEffect(() => {
    // The inline snippet already counted the page it loaded on. Firing here too
    // would double every entry.
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq
    // Absent if the script is still loading or an ad blocker removed it. Neither
    // is an error worth surfacing to a shopper.
    if (typeof fbq === 'function') fbq('track', 'PageView')
  }, [pathname])

  return null
}
