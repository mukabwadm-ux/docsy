import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms' }

/**
 * Placeholder terms. Written to be honest about the phase-1 manual fulfilment
 * flow rather than to look like boilerplate copied from a SaaS — but this is not
 * legal advice and should be reviewed before any real volume.
 */
export default function TermsPage() {
  return (
    <div className="container max-w-2xl py-14">
      <h1 className="text-3xl">Terms of sale</h1>
      <div className="prose-sales mt-6">
        <p>
          Docsy sells digital products — files you download and keep. Buying one grants you a
          personal, non-exclusive licence to use it, including in your own commercial work.
        </p>
        <p>
          You may not resell, redistribute or republish a file as-is, or as the substantial part of
          a competing product.
        </p>
        <h2 className="mt-8 text-xl">Delivery</h2>
        <p>
          Orders placed on this site are confirmed by hand while automated checkout is being
          finished. After you place an order we email your download link, normally within a few
          hours. Links expire after seven days; if yours lapses, reply to the delivery email and we
          will send a fresh one.
        </p>
        <h2 className="mt-8 text-xl">Refunds</h2>
        <p>
          Because a delivered file cannot be returned, sales are final once the download link has
          been sent. If a file is corrupt, incomplete, or not what the product page described, tell
          us and we will fix it or refund you in full.
        </p>
        <h2 className="mt-8 text-xl">Contact</h2>
        <p>Reply to any Docsy email and it reaches a person.</p>
      </div>
    </div>
  )
}
