import { NextResponse } from 'next/server'
import { searchSuggestions } from '@/lib/queries'
import { convert, formatMoney, getRates } from '@/lib/currency'

/**
 * Typeahead endpoint.
 *
 * Goes through a route handler rather than querying Supabase from the browser so
 * that the tsquery sanitising and the substring fallback in lib/queries stay in
 * one place — a second, client-side copy of that logic would drift from the one
 * the /search page uses, and the dropdown would start disagreeing with the page
 * it links to.
 */
export const dynamic = 'force-dynamic'

const MIN_LENGTH = 2
const LIMIT = 6

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''

  // One or two characters match most of the catalog, so the results are noise
  // and the query is wasted. Answer immediately instead.
  if (q.length < MIN_LENGTH) {
    return NextResponse.json({ query: q, products: [], categories: [] })
  }

  try {
    const [{ products, categories }, rates] = await Promise.all([
      searchSuggestions(q, LIMIT),
      getRates(),
    ])

    return NextResponse.json(
      {
        query: q,
        categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
        products: products.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          price: p.price,
          currency: p.currency,
          // Both formatted here so the dropdown never does currency maths, and
          // never disagrees with the card behind it.
          priceUsd: formatMoney(p.price, 'USD'),
          priceKes: formatMoney(convert(p.price, 'KES', rates), 'KES'),
          file_type: p.file_type,
          preview_image_url: p.preview_image_url,
          rating_avg: p.rating_avg,
          rating_count: p.rating_count,
        })),
      },
      {
        // Repeated prefixes are extremely common while typing ("t", "te",
        // "tem", then backspace), so a short shared cache absorbs most of the
        // load without ever showing a stale catalog for long.
        headers: {
          'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch {
    // A failed suggestion lookup must not surface as an error to someone who is
    // simply typing. The form still submits to /search.
    return NextResponse.json({ query: q, products: [], categories: [] }, { status: 200 })
  }
}
