const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Only Supabase Storage. Every cover image is uploaded through the admin
    // panel and re-hosted here, so there is no third-party host to allow.
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    /**
     * Trimmed from the defaults, which run to 2048 and 3840.
     *
     * Not for markup size: the candidate URLs are long and repetitive, but that
     * is exactly what compresses well — brotli takes this page's HTML from 173 KB
     * to 16 KB, so dropping sizes saves under a kilobyte over the wire and is not
     * worth doing for its own sake.
     *
     * The reason is the transforms behind them. Every size in this list is a
     * variant the optimizer may be asked to generate, store and serve, and a
     * 3840px re-encode of a cover thumbnail costs real time and bandwidth for a
     * display no visitor of this shop is browsing on. 1920 is kept so a large
     * monitor still gets a sharp image at 50vw; 2048 and 3840 are not.
     */
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [256, 384],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

export default nextConfig
