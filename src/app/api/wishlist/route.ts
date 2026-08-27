import { NextResponse } from 'next/server'
import { getBuyerSession } from '@/lib/buyer'
import { getWishlistIds } from '@/lib/account-data'

/**
 * The signed-in buyer's saved product ids.
 *
 * Exists so pages do not have to read the session to draw a wishlist heart.
 * Reading it server-side opts the whole route out of static rendering — in Next 14
 * a single cookies() call anywhere in the tree does that — which cost the product
 * page its prerendering and made every visitor wait on a render plus database
 * round trip for a control most of them never touch.
 *
 * Anonymous callers get an empty list and a 200, not a 401: "nothing saved" is the
 * correct answer for someone with no account, and an error status would put a
 * failed request in the console of every visitor who is not signed in.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getBuyerSession()
  if (!session) {
    return NextResponse.json({ ids: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const ids = await getWishlistIds(session.userId)
  return NextResponse.json(
    { ids: Array.from(ids) },
    // Private: this is one buyer's list and must never be held in a shared cache.
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
