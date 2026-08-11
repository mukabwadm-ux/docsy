import type { Metadata } from 'next'
import { AccountLoginForm } from '@/components/account/login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: true },
}

export default function AccountLoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string }
}) {
  return (
    <div className="container max-w-md py-14">
      <h1 className="text-3xl">Sign in</h1>
      <p className="mt-2 text-brand-body">
        Your account keeps every file you buy, ready to re-download whenever you need it.
      </p>
      <div className="mt-8">
        <AccountLoginForm next={searchParams.next} linkError={searchParams.error} />
      </div>
    </div>
  )
}
