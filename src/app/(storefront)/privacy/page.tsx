import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl py-14">
      <h1 className="text-3xl">Privacy</h1>
      <div className="prose-sales mt-6">
        <h2 className="mt-8 text-xl">What we collect</h2>
        <p>
          When you place an order we store your name, your email address and any note you add. That
          is all — there is no account to create and no password to lose.
        </p>
        <p>
          We also count page views per product. That counter is a single number on the product row;
          it is not tied to you and we do not build a profile from it.
        </p>
        <h2 className="mt-8 text-xl">What we do with it</h2>
        <p>
          Your email is used to deliver what you bought and to reply to you about it. If a product
          you own gets an update, we may email you about that too.
        </p>
        <p>We do not sell your details, and we do not pass them to advertisers.</p>
        <h2 className="mt-8 text-xl">Where it lives</h2>
        <p>
          Order records are stored in our database, hosted by Supabase in the EU. Files are stored
          in private storage and are only reachable through a signed link that expires.
        </p>
        <h2 className="mt-8 text-xl">Removing your data</h2>
        <p>
          Reply to any Docsy email and ask, and we will delete your order records. Note that this
          also removes our record of what you bought, so we will no longer be able to re-send a
          download link.
        </p>
      </div>
    </div>
  )
}
