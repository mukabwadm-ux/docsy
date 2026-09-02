import Script from 'next/script'
import { getAnalyticsConfig } from '@/lib/config'
import { PixelPageViews } from '@/components/pixel-page-views'

/**
 * Analytics tags, from whatever the owner configured.
 *
 * Rendered in the storefront layout only, never in the admin panel — tracking an
 * owner clicking around their own dashboard pollutes every conversion figure and
 * is the commonest way a small shop ends up with meaningless data.
 *
 * `afterInteractive` rather than `beforeInteractive`: none of these are needed to
 * paint the page, and loading them earlier delays first paint for a script whose
 * whole job is to observe it.
 *
 * Renders nothing at all when nothing is set, so an unconfigured shop ships no
 * third-party requests.
 */
export async function Analytics() {
  const { ga4, gtm, metaPixel, tiktokPixel } = await getAnalyticsConfig()

  if (!ga4 && !gtm && !metaPixel && !tiktokPixel) return null

  return (
    <>
      {gtm && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      )}

      {/* GA4 is skipped when GTM is present: a container almost always carries a
          GA4 tag of its own, and loading both double-counts every pageview. */}
      {ga4 && !gtm && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      )}

      {metaPixel && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`}
          </Script>

          {/* The script above counts the first page only; the App Router changes
              pages without reloading. */}
          <PixelPageViews />

          {/* Meta's own snippet includes this. It is the only way a visitor with
              JavaScript off is counted, and it costs one request. */}
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              alt=""
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(metaPixel)}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {tiktokPixel && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktokPixel}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
    </>
  )
}
