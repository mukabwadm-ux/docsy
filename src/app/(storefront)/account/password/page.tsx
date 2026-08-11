import type { Metadata } from 'next'
import { PasswordForm } from '@/components/account/password-form'
import { requireBuyerAllowingSetup } from '@/lib/buyer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Set your password',
  robots: { index: false, follow: false },
}

/**
 * Uses requireBuyerAllowingSetup rather than requireBuyer.
 *
 * requireBuyer redirects anyone carrying must_set_password to this page, so
 * guarding this page with it would redirect to itself forever.
 */
export default async function PasswordPage({ searchParams }: { searchParams: { first?: string } }) {
  const session = await requireBuyerAllowingSetup()
  const isFirstTime = searchParams.first === '1' || session.mustSetPassword

  return (
    <div className="container max-w-md py-14">
      <h1 className="text-3xl">{isFirstTime ? 'Choose a password' : 'Change your password'}</h1>
      <p className="mt-2 text-brand-body">
        {isFirstTime
          ? `Your account is ready for ${session.email}. Pick a password and you are in — we never emailed you one.`
          : 'Pick something you are not using anywhere else.'}
      </p>
      <div className="mt-8">
        <PasswordForm isFirstTime={isFirstTime} />
      </div>
    </div>
  )
}
