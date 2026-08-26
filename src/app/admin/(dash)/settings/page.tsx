import { PageHeader } from '@/components/admin/ui'
import { IntegrationForm } from '@/components/admin/integration-form'
import { RateForm } from '@/components/admin/rate-form'
import { requireAdmin } from '@/lib/auth'
import { getConfigForAdmin } from '@/lib/config'
import { CONFIG_GROUPS } from '@/lib/config-registry'
import { getRates } from '@/lib/currency'
import { isEncryptionConfigured, ENCRYPTION_SETUP_HINT } from '@/lib/secret-box'

export const dynamic = 'force-dynamic'

/**
 * Everything configurable, in one place.
 *
 * Secrets are shown masked and never leave the server in full. Values provided by
 * environment variables are rendered read-only with a note saying so, because
 * silently ignoring what somebody typed is worse than telling them where the
 * value actually comes from.
 */
export default async function StoreSettingsPage() {
  await requireAdmin()

  const [rates, resolved] = await Promise.all([getRates(), getConfigForAdmin()])
  const encryptionReady = isEncryptionConfigured()

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Pricing, integrations and API keys. Nothing here needs a redeploy."
      />

      <div className="space-y-6">
        {CONFIG_GROUPS.map((group) => (
          <IntegrationForm
            key={group.id}
            group={group}
            resolved={resolved}
            encryptionReady={encryptionReady}
            encryptionHint={ENCRYPTION_SETUP_HINT}
          />
        ))}

        <section>
          <h2 className="mb-3 text-lg">Currency</h2>
          <RateForm
            usdToKes={rates.usdToKes}
            kesRounding={rates.kesRounding}
            geoEnabled={rates.geoPricingEnabled}
            rateUpdatedAt={rates.rateUpdatedAt}
          />
        </section>
      </div>

      <p className="mt-8 max-w-2xl text-xs text-brand-body/70">
        Secrets are encrypted before they are written, with a key held only in the environment — so
        reaching the database alone yields ciphertext. Environment variables take precedence over
        anything set here, which means write access to the database cannot redirect the shop&apos;s
        payments.
      </p>
    </>
  )
}
