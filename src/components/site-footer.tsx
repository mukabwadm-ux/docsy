import Link from 'next/link'
import { FileText, Globe, ShieldCheck, Zap } from 'lucide-react'

const TRUST = [
  { icon: Zap, label: 'Instant delivery', detail: 'Download link by email' },
  { icon: ShieldCheck, label: 'Secure checkout', detail: 'Your details stay private' },
  { icon: Globe, label: 'Sold worldwide', detail: 'Priced in USD' },
]

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-brand-cream">
      <div className="container py-12">
        <div className="grid gap-8 border-b border-brand-tan pb-10 sm:grid-cols-3">
          {TRUST.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-cta" aria-hidden />
              <div>
                <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
                  {label}
                </p>
                <p className="mt-0.5 text-sm text-brand-body">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-cta text-white">
              <FileText className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-heading text-xl font-bold uppercase tracking-tight text-brand-heading">
              Docsy
            </span>
          </Link>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { href: '/products', label: 'All products' },
              { href: '/search', label: 'Search' },
              { href: '/terms', label: 'Terms' },
              { href: '/privacy', label: 'Privacy' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body transition-colors hover:text-brand-cta"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 text-xs text-brand-body/70">
          © {new Date().getFullYear()} Docsy. All products are digital downloads. Because files
          cannot be returned once delivered, sales are final — but if something is wrong with a
          file, reply to your delivery email and we will fix it.
        </p>
      </div>
    </footer>
  )
}
