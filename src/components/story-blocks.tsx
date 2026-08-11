import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { StoryBlock } from '@/lib/types'

/**
 * The story section from the reference: alternating text and image, image on the
 * right for the first block and flipping thereafter.
 *
 * Blocks without an image render as a full-width copy column instead of leaving
 * a hole — the seller writing these should not have to supply an image just to
 * keep the layout from breaking.
 */
export function StoryBlocks({ blocks }: { blocks: StoryBlock[] }) {
  const usable = blocks.filter((b) => b.heading || b.body || b.image_url)
  if (usable.length === 0) return null

  return (
    <section className="container py-14 lg:py-20">
      <div className="space-y-16 lg:space-y-24">
        {usable.map((block, i) => {
          const hasImage = Boolean(block.image_url)
          const imageFirst = i % 2 === 1

          if (!hasImage) {
            return (
              <div key={i} className="mx-auto max-w-2xl text-center">
                {block.heading && (
                  <h2 className="text-2xl leading-snug sm:text-3xl">{block.heading}</h2>
                )}
                {block.body && (
                  <div className="prose-sales mt-5 [&>p]:mx-auto">
                    {paragraphs(block.body)}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div key={i} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={cn(imageFirst && 'lg:order-2')}>
                {block.heading && (
                  <h2 className="text-2xl leading-snug sm:text-3xl">{block.heading}</h2>
                )}
                {block.body && <div className="prose-sales mt-5">{paragraphs(block.body)}</div>}
              </div>

              <div className={cn('relative', imageFirst && 'lg:order-1')}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-cream">
                  <Image
                    src={block.image_url!}
                    alt={block.heading ?? ''}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Blank-line-separated text becomes paragraphs. The reference's story copy is
 * short paragraphs with deliberate pauses between them, and rendering the whole
 * field as one block would collapse that rhythm into a wall.
 */
function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>)
}
