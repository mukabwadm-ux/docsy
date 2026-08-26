import { PageHeader } from '@/components/admin/ui'
import { RateForm } from '@/components/admin/rate-form'
import { requireAdmin } from '@/lib/auth'
import { getRates } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default async function StoreSettingsPage() {
  await requireAdmin()
  const rates = await getRates()

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Pricing and currency. Products are priced in USD; KES is converted from it."
      />
      <RateForm
        usdToKes={rates.usdToKes}
        kesRounding={rates.kesRounding}
        geoEnabled={rates.geoPricingEnabled}
        rateUpdatedAt={rates.rateUpdatedAt}
      />
    </>
  )
}
