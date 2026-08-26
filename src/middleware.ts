import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { CURRENCY_COOKIE } from '@/lib/currency'

const SESSION_PATHS = ['/admin', '/account', '/checkout']

/**
 * Two jobs, deliberately scoped differently.
 *
 * Currency: every request gets a currency cookie, set from the edge's country
 * header the first time. Doing it here rather than in a page keeps the catalog
 * statically renderable — a page that called cookies() would opt out of static
 * generation entirely, and the prices are the only per-visitor thing on it.
 *
 * Session refresh: only where a session is actually read. Server Components can
 * read cookies but not write them, so without a refresh the token quietly expires
 * mid-visit. Running it on the catalog would cost every anonymous visitor a round
 * trip for a session they do not have.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const path = request.nextUrl.pathname
  const needsSession = SESSION_PATHS.some((p) => path.startsWith(p))

  if (needsSession) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          get: (name: string) => request.cookies.get(name)?.value,
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    await supabase.auth.getUser()
  }

  /**
   * Only set when absent. A visitor who picked a currency has that choice in this
   * same cookie, and overwriting it from geo on every request would make the
   * switcher appear broken for anyone whose location disagrees with their choice.
   */
  if (!request.cookies.get(CURRENCY_COOKIE)) {
    const country =
      request.headers.get('x-vercel-ip-country') ??
      request.headers.get('cf-ipcountry') ??
      ''

    response.cookies.set({
      name: CURRENCY_COOKIE,
      value: country.toUpperCase() === 'KE' ? 'KES' : 'USD',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      // Read by an inline script before paint, so it cannot be httpOnly.
      httpOnly: false,
    })
  }

  return response
}

export const config = {
  // Everything except static assets and images — the currency cookie is needed
  // on any page that can show a price.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)'],
}
