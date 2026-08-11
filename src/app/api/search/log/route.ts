import { NextResponse } from 'next/server'
import { recordSearch } from '@/lib/insights'

/**
 * Records a typeahead query that found nothing and was then abandoned.
 *
 * The client waits until the visitor has stopped typing and the result set is
 * empty before calling this, so it fires once per genuine dead end rather than
 * once per keystroke.
 *
 * Only zero-result queries are accepted here. A successful typeahead search
 * needs no logging — the visitor found what they wanted, and if they open the
 * product the interesting number is already the view count.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { q?: unknown }
    const q = typeof body.q === 'string' ? body.q.trim() : ''

    if (q.length < 3 || q.length > 120) {
      return new NextResponse(null, { status: 204 })
    }

    // The count is not taken from the request. A client could claim anything,
    // and this table is what product decisions get made from — so it is
    // recorded as the zero-result case this endpoint exists for.
    await recordSearch(q, 0)
    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
