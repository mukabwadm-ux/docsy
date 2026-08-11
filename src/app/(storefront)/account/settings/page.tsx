import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { SettingsForm } from '@/components/account/settings-form'
import { requireBuyer } from '@/lib/buyer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } }

export default async function SettingsPage() {
  const session = await requireBuyer('/account/settings')

  return (
    <div className="max-w-lg">
      <h2 className="text-xl">Settings</h2>

      <div className="mt-4 rounded-lg border border-border bg-white p-5 shadow-card">
        <SettingsForm
          fullName={session.fullName ?? ''}
          email={session.email}
          marketingOptIn={session.marketingOptIn}
        />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-white p-5 shadow-card">
        <p className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
          Password
        </p>
        <p className="mt-1 text-sm text-brand-body">
          Change the password you use to sign in.
        </p>
        <Link
          href="/account/password"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading transition-colors hover:border-brand-cta hover:text-brand-cta"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          Change password
        </Link>
      </div>
    </div>
  )
}
