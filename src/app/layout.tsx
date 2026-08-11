import type { Metadata, Viewport } from 'next'
import { Oswald, Lora } from 'next/font/google'
import './globals.css'

/**
 * Oswald 700 for headlines and CTAs, per the reference. 400 and 500 come along
 * for eyebrows, labels and prices, which need the condensed face at a readable
 * weight. Every extra weight is another file on the critical path, and the
 * hero's LCP element is text — so the font payload, not any image, is what
 * gates first paint.
 */
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

/** Lora for body copy. Regular and one heavier cut for lead paragraphs. */
const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-lora',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Docsy — Ebooks, templates and guides you can use today',
    template: '%s · Docsy',
  },
  description:
    'Practical digital products — ebooks, templates, guides and design assets. Buy once, download instantly, use forever.',
  openGraph: {
    type: 'website',
    siteName: 'Docsy',
    locale: 'en_US',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#EB2437',
  width: 'device-width',
  initialScale: 1,
}

/**
 * Fonts and document shell only. The storefront chrome lives in the
 * (storefront) group — the admin panel has its own shell and must not inherit
 * the public header and footer.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  )
}
