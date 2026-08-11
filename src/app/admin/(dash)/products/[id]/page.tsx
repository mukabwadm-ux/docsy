import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/ui'
import { ProductForm } from '@/components/admin/product-form'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminProduct, Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { created?: string }
}) {
  await requireAdmin()
  const db = createAdminClient()

  const [{ data: product }, { data: categories }] = await Promise.all([
    db
      .from('products')
      // Explicit column list, not `*` — this is the one place file_url is read,
      // and naming it documents that the secret-key client is what makes it
      // visible at all.
      .select(
        `id, title, slug, description, short_description, benefits, story_content,
         how_it_works, announcement_text, price, compare_at_price, currency,
         category_id, file_url, file_size_mb, file_type, preview_image_url,
         is_featured, views_count, sales_count, rating_avg, rating_count,
         status, created_at, updated_at,
         product_images ( id, image_url, alt_text, sort_order )`
      )
      .eq('id', params.id)
      .maybeSingle(),
    db
      .from('categories')
      .select('id, name, slug, description, icon, sort_order')
      .order('sort_order')
      .order('name'),
  ])

  if (!product) notFound()

  const typed = product as unknown as AdminProduct
  typed.benefits = Array.isArray(typed.benefits) ? typed.benefits : []
  typed.story_content = Array.isArray(typed.story_content) ? typed.story_content : []
  typed.how_it_works = Array.isArray(typed.how_it_works) ? typed.how_it_works : []
  typed.product_images = (typed.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <PageHeader title={typed.title} subtitle={`/products/${typed.slug}`} />
      <ProductForm
        product={typed}
        categories={(categories as Category[]) ?? []}
        justCreated={searchParams.created === '1'}
      />
    </>
  )
}
