import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        /**
         * /admin is already behind auth and /api returns JSON, so this is not a
         * security measure — it stops crawl budget being spent on pages that
         * will only ever answer with a redirect to a login form. /search is
         * excluded because it can generate unbounded near-duplicate URLs.
         */
        disallow: ['/admin', '/api/', '/search'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
