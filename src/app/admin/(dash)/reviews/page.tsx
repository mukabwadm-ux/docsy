import Link from 'next/link'
import { Star } from 'lucide-react'
import { deleteReview, setReviewStatus } from '@/actions/admin'
import { ActionButton } from '@/components/admin/action-button'
import { SeedReviewForm } from '@/components/admin/seed-review-form'
import { Card, EmptyState, PageHeader, StatusPill, Table, Td, Th } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { formatRelative } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface ReviewRow {
  id: string
  reviewer_name: string
  reviewer_location: string | null
  rating: number
  review_text: string | null
  source: 'seed' | 'visitor'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  products: { id: string; title: string } | null
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  await requireAdmin()
  const filter = ['pending', 'approved', 'rejected'].includes(searchParams.filter ?? '')
    ? searchParams.filter!
    : 'pending'

  const db = createAdminClient()
  const [{ data }, { data: products }] = await Promise.all([
    db
      .from('reviews')
      .select(
        'id, reviewer_name, reviewer_location, rating, review_text, source, status, created_at, products ( id, title )'
      )
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('products').select('id, title').order('title'),
  ])

  const reviews = (data ?? []) as unknown as ReviewRow[]

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Visitor reviews arrive as pending and stay off the page until approved."
      />

      <Card className="mb-6 p-5">
        <h2 className="text-lg">Add a review yourself</h2>
        <p className="mt-1 text-sm text-brand-body">
          For testimonials collected over email. Saved as a seed review so it stays
          distinguishable from organic ones, and published immediately.
        </p>
        <div className="mt-4">
          <SeedReviewForm products={(products as { id: string; title: string }[]) ?? []} />
        </div>
      </Card>

      <div className="mb-4 flex gap-2">
        {['pending', 'approved', 'rejected'].map((t) => (
          <Link
            key={t}
            href={`/admin/reviews?filter=${t}`}
            className={
              filter === t
                ? 'rounded-full border border-brand-cta bg-brand-cta px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide capitalize text-white'
                : 'rounded-full border border-border bg-white px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wide capitalize text-brand-body hover:border-brand-cta hover:text-brand-cta'
            }
          >
            {t}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'Nothing to moderate' : `No ${filter} reviews`}
          hint={
            filter === 'pending'
              ? 'New visitor reviews will appear here for approval.'
              : undefined
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Review</Th>
              <Th>Product</Th>
              <Th>Source</Th>
              <Th>When</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={
                          i < r.rating ? 'h-3.5 w-3.5 text-brand-cta' : 'h-3.5 w-3.5 text-[#d9d3c4]'
                        }
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden
                      />
                    ))}
                    <span className="ml-1 font-medium text-brand-heading">{r.reviewer_name}</span>
                    {r.reviewer_location && (
                      <span className="text-xs text-brand-body/60">· {r.reviewer_location}</span>
                    )}
                  </div>
                  {r.review_text && (
                    <p className="mt-1.5 max-w-md text-sm text-brand-body">{r.review_text}</p>
                  )}
                </Td>

                <Td>
                  {r.products ? (
                    <Link
                      href={`/admin/products/${r.products.id}`}
                      className="text-brand-heading hover:text-brand-cta"
                    >
                      {r.products.title}
                    </Link>
                  ) : (
                    <span className="text-brand-body/60">—</span>
                  )}
                </Td>

                <Td>
                  <StatusPill status={r.source === 'seed' ? 'draft' : 'active'} />
                  <span className="mt-1 block text-[11px] text-brand-body/60">{r.source}</span>
                </Td>

                <Td className="whitespace-nowrap text-xs text-brand-body/70">
                  {formatRelative(r.created_at)}
                </Td>

                <Td>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {r.status !== 'approved' && (
                      <ActionButton
                        variant="primary"
                        action={setReviewStatus.bind(null, r.id, 'approved')}
                      >
                        Approve
                      </ActionButton>
                    )}
                    {r.status !== 'rejected' && (
                      <ActionButton action={setReviewStatus.bind(null, r.id, 'rejected')}>
                        Reject
                      </ActionButton>
                    )}
                    <ActionButton
                      variant="danger"
                      confirm="Delete"
                      action={deleteReview.bind(null, r.id)}
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
