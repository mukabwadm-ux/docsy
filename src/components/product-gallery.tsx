'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProductImage } from '@/lib/types'

/**
 * Hero image with dot navigation, matching the reference's single large frame.
 *
 * Thumbnails are deliberately dots, not a filmstrip: the hero is the widest
 * element on the page and a strip of thumbnails under it competes with the
 * benefit list for the eye at exactly the moment the CTA needs to win.
 */
export function ProductGallery({
  images,
  title,
  fallbackImage,
}: {
  images: ProductImage[]
  title: string
  fallbackImage?: string | null
}) {
  const gallery =
    images.length > 0
      ? images
      : fallbackImage
        ? [{ id: 'cover', image_url: fallbackImage, alt_text: title, sort_order: 0 }]
        : []

  const [active, setActive] = useState(0)
  const current = gallery[Math.min(active, gallery.length - 1)]

  if (gallery.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-brand-cream lg:aspect-auto lg:h-full lg:min-h-[520px]">
        <FileText className="h-16 w-16 text-brand-tan" aria-hidden />
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-brand-cream lg:rounded-none">
      <div className="relative aspect-[4/5] lg:aspect-auto lg:h-full lg:min-h-[560px]">
        <Image
          src={current.image_url}
          alt={current.alt_text ?? title}
          fill
          // The hero image is the LCP element on this page — it must not be
          // lazy-loaded, and it is served at up to half the viewport on desktop.
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {gallery.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/25 px-3 py-2 backdrop-blur">
          {gallery.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${gallery.length}`}
              aria-current={i === active}
              className={cn(
                'h-2 rounded-full transition-all',
                i === active ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/90'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
