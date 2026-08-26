import { Analytics } from '@/components/analytics'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

/**
 * Public chrome. Lives in a route group so the admin panel, which sits outside
 * it, never inherits the storefront header and footer.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {/* Storefront only. Tracking the owner clicking round the admin panel
          pollutes every conversion figure it later reports on. */}
      <Analytics />
    </div>
  )
}
