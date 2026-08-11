import Link from 'next/link'
import { Heart, LogOut, Settings, ShoppingBag } from 'lucide-react'
import { buyerSignOut } from '@/actions/account'
import { getBuyerSession } from '@/lib/buyer'

const NAV = [
  { href: '/account', label: 'Purchases', icon: ShoppingBag },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/settings', label: 'Settings', icon: Settings },
]

/**
 * Chrome for the buyer dashboard.
 *
 * Renders bare children when there is no session, and does not redirect:
 * /account/login and /account/callback live under this path too, and a redirect
 * here would trap a signed-out visitor in a loop on the very pages that let them
 * in. Each page guards itself with requireBuyer(), which is also why a layout is
 * not treated as a security boundary.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getBuyerSession()

  if (!session || session.mustSetPassword) return <>{children}</>

  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-cta">
            Your account
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl">{session.fullName?.trim() || session.email}</h1>
        </div>
        <form action={buyerSignOut}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </button>
        </form>
      </div>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-white px-4 py-2 font-heading text-sm font-bold uppercase tracking-wide text-brand-body transition-colors hover:border-brand-cta hover:text-brand-cta"
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  )
}
