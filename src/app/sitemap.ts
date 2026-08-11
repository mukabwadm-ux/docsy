import type { MetadataRoute } from 'next'
import { getAllProductSlugs, getCategories } from '@/lib/queries'

/**
 * Regenerated hourly. A sitemap that is stale for a day is worse than useless on
 * a shop where a new product is the whole point of the update.
 */
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A failed query must not take the whole sitemap down — an empty-but-valid
  // sitemap is recoverable, a 500 gets the URL dropped from Search Console.
  const [slugs, categories] = await Promise.all([
    getAllProductSlugs().catch(() => []),
    getCategories().catch(() => []),
  ])

  const now = new Date()

  return [
    { url: siteUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((c) => ({
      url: `${siteUrl}/products?category=${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...slugs.map(({ slug }) => ({
      url: `${siteUrl}/products/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${siteUrl}/terms`, changeFrequency: 'yearly' as const, priority: 0.2 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly' as const, priority: 0.2 },
  ]
}
