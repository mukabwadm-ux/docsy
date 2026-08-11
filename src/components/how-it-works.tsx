import Image from 'next/image'
import type { HowItWorksStep } from '@/lib/types'

/**
 * The cream band with numbered step cards, per the reference.
 *
 * Steps are numbered from their position, not from `step_number`. That field is
 * authoring convenience; trusting it means a seller who duplicates a row ships
 * a page with two "Step 2"s.
 */
export function HowItWorks({
  steps,
  heading,
  intro,
}: {
  steps: HowItWorksStep[]
  heading?: string
  intro?: string
}) {
  const usable = steps.filter((s) => s.title || s.caption || s.image_url)
  if (usable.length === 0) return null

  return (
    <section className="border-y border-brand-tan bg-brand-cream py-14 lg:py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl leading-snug sm:text-3xl lg:text-4xl">
            {heading ?? 'How it works'}
          </h2>
          {intro && (
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-brand-body">
              {intro}
            </p>
          )}
        </div>

        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {usable.map((step, i) => (
            <li
              key={i}
              className="flex flex-col overflow-hidden rounded-xl border border-brand-tan bg-white shadow-card"
            >
              {step.image_url && (
                <div className="relative aspect-[4/3] bg-brand-cream">
                  <Image
                    src={step.image_url}
                    alt={step.title ?? `Step ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              )}

              <div className="flex flex-1 flex-col p-5">
                <span className="inline-flex w-fit rounded-md bg-brand-tan px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-widest text-brand-heading">
                  Step {i + 1}
                </span>
                {step.title && <h3 className="mt-3 text-lg leading-snug">{step.title}</h3>}
                {step.caption && (
                  <p className="mt-2 text-[15px] leading-relaxed text-brand-body">{step.caption}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
