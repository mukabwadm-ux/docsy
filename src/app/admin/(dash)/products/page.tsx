import Image from 'next/image'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { setProductStatus, deleteProduct } from '@/actions/admin'
import { ActionButton } from '@/components/admin/action-button'
import { EmptyState, PageHeader, StatusPill, Table, Td, Th } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/auth'
import { formatPrice } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminProduct } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  await requireAdmin()

  const { data } = await createAdminClient()
    .from('products')
    .select(
      'id, title, slug, price, currency, status, is_featured, file_url, preview_image_url, sales_count, rating_avg, rating_count, created_at'
    )
    .order('created_at', { ascending: false })

  const products = (data ?? []) as Pick<
    AdminProduct,
    | 'id'
    | 'title'
    | 'slug'
    | 'price'
    | 'currency'
    | 'status'
    | 'is_featured'
    | 'file_url'
    | 'preview_image_url'
    | 'sales_count'
    | 'rating_avg'
    | 'rating_count'
    | 'created_at'
  >[]

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${products.length} total`}
        action={
          <Button asChild variant="cta" size="md">
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4" aria-hidden />
              New product
            </Link>
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          hint="Create your first one, upload the file, and set it live."
          action={
            <Button asChild variant="cta" size="md">
              <Link href="/admin/products/new">Create product</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-16" />
              <Th>Product</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>File</Th>
              <Th>Sales</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <Td>
                  <div className="relative h-12 w-10 overflow-hidden rounded border border-border bg-brand-cream">
                    {p.preview_image_url ? (
                      <Image
                        src={p.preview_image_url}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <FileText className="h-4 w-4 text-brand-tan" aria-hidden />
                      </span>
                    )}
                  </div>
                </Td>

                <Td>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="font-medium text-brand-heading hover:text-brand-cta"
                  >
                    {p.title}
                  </Link>
                  <span className="mt-0.5 block text-xs text-brand-body/70">/{p.slug}</span>
                  {p.is_featured && (
                    <span className="mt-1 inline-block rounded bg-brand-tan px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-heading">
                      Featured
                    </span>
                  )}
                </Td>

                <Td className="whitespace-nowrap">{formatPrice(p.price, p.currency)}</Td>

                <Td>
                  <StatusPill status={p.status} />
                </Td>

                <Td>
                  {p.file_url ? (
                    <span className="font-heading text-[11px] font-bold uppercase tracking-wide text-green-700">
                      Attached
                    </span>
                  ) : (
                    // The one problem worth shouting about on this screen: an
                    // active product with no file can be bought and not fulfilled.
                    <span className="font-heading text-[11px] font-bold uppercase tracking-wide text-red-600">
                      {p.status === 'active' ? 'Missing!' : 'None'}
                    </span>
                  )}
                </Td>

                <Td className="whitespace-nowrap text-xs text-brand-body/70">
                  {p.sales_count} sold
                  {p.rating_count > 0 && ` · ${Number(p.rating_avg).toFixed(1)}★`}
                </Td>

                <Td>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {p.status === 'active' ? (
                      <ActionButton action={setProductStatus.bind(null, p.id, 'draft')}>
                        Unpublish
                      </ActionButton>
                    ) : (
                      <ActionButton
                        variant="primary"
                        action={setProductStatus.bind(null, p.id, 'active')}
                      >
                        Publish
                      </ActionButton>
                    )}
                    <ActionButton
                      variant="danger"
                      confirm="Delete"
                      action={deleteProduct.bind(null, p.id)}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
