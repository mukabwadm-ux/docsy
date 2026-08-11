import { PageHeader } from '@/components/admin/ui'
import { ProductForm } from '@/components/admin/product-form'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireAdmin()

  const { data } = await createAdminClient()
    .from('categories')
    .select('id, name, slug, description, icon, sort_order')
    .order('sort_order')
    .order('name')

  return (
    <>
      <PageHeader
        title="New product"
        subtitle="Save the basics first, then add the sales page and the file."
      />
      <ProductForm categories={(data as Category[]) ?? []} />
    </>
  )
}
