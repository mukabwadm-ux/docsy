import { deleteCategory } from '@/actions/admin'
import { ActionButton } from '@/components/admin/action-button'
import { CategoryForm } from '@/components/admin/category-form'
import { Card, EmptyState, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  await requireAdmin()
  const db = createAdminClient()

  const [{ data: categories }, { data: products }] = await Promise.all([
    db
      .from('categories')
      .select('id, name, slug, description, icon, sort_order')
      .order('sort_order')
      .order('name'),
    db.from('products').select('category_id'),
  ])

  const counts = new Map<string, number>()
  for (const p of (products as { category_id: string | null }[]) ?? []) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  }

  const rows = (categories as {
    id: string
    name: string
    slug: string
    description: string | null
    icon: string | null
    sort_order: number
  }[]) ?? []

  return (
    <>
      <PageHeader title="Categories" subtitle="How the storefront groups products." />

      <Card className="mb-6 p-5">
        <h2 className="text-lg">Add a category</h2>
        <div className="mt-4">
          <CategoryForm />
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No categories yet"
          hint="Products work without one, but categories are how visitors browse."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Icon</Th>
              <Th>Products</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td>
                  <span className="font-medium text-brand-heading">{c.name}</span>
                  {c.description && (
                    <span className="mt-0.5 block max-w-sm text-xs text-brand-body/70">
                      {c.description}
                    </span>
                  )}
                </Td>
                <Td className="text-xs text-brand-body/70">/{c.slug}</Td>
                <Td className="text-xs text-brand-body/70">{c.icon ?? '—'}</Td>
                <Td>{counts.get(c.id) ?? 0}</Td>
                <Td className="text-right">
                  <ActionButton
                    variant="danger"
                    confirm="Delete"
                    action={deleteCategory.bind(null, c.id)}
                  >
                    Delete
                  </ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <p className="mt-4 text-xs text-brand-body/70">
        Deleting a category leaves its products in place — they simply become uncategorised.
      </p>
    </>
  )
}
