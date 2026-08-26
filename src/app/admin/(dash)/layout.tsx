import Link from 'next/link'
import {
  ChartNoAxesColumn,
  Contact,
  Mail,
  Megaphone,
  Settings,
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  Star,
} from 'lucide-react'
import { signOut } from '@/actions/auth'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, badge: 'orders' },
  { href: '/admin/reviews', label: 'Reviews', icon: Star, badge: 'reviews' },
  { href: '/admin/insights', label: 'Insights', icon: ChartNoAxesColumn },
  { href: '/admin/audience', label: 'Audience', icon: Contact },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
] as const

/**
 * Admin shell. requireAdmin() here guards every page in the group — but each
 * page and action re-checks on its own too, because a layout is not a security
 * boundary: Next can serve a nested page without re-running an outer layout.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()

  // Counts of work waiting, so the nav says where to go next.
  const db = createAdminClient()
  const [{ count: pendingOrders }, { count: pendingReviews }] = await Promise.all([
    db.from('manual_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const badges: Record<string, number> = {
    orders: pendingOrders ?? 0,
    reviews: pendingReviews ?? 0,
  }

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-cta text-white">
              <FileText className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-heading text-xl font-bold uppercase tracking-tight text-brand-heading">
              Docsy
            </span>
            <span className="rounded bg-brand-cream px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body">
              Admin
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="hidden font-heading text-xs font-bold uppercase tracking-wide text-brand-body hover:text-brand-cta sm:block"
            >
              View store
            </Link>
            <span className="hidden text-xs text-brand-body/70 md:block">{session.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 no-scrollbar">
          {NAV.map(({ href, label, icon: Icon, ...rest }) => {
            const badge = 'badge' in rest ? badges[rest.badge as string] : 0
            return (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 font-heading text-sm font-bold uppercase tracking-wide text-brand-body transition-colors hover:border-brand-cta hover:text-brand-cta"
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
                {badge > 0 && (
                  <span className="rounded-full bg-brand-cta px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
