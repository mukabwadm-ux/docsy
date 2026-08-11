'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, ExternalLink, GripVertical, Loader2, Plus, Trash2 } from 'lucide-react'
import { createProduct, updateProduct, type ActionState } from '@/actions/admin'
import { ImageField, InlineImageField, ProductFileField } from '@/components/admin/file-field'
import { Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { slugify } from '@/lib/utils'
import type { AdminProduct, Category, HowItWorksStep, StoryBlock } from '@/lib/types'

const initial: ActionState = { status: 'idle' }

const FILE_TYPES = ['pdf', 'zip', 'epub', 'xlsx', 'docx', 'figma', 'canva', 'notion']

export function ProductForm({
  product,
  categories,
  justCreated = false,
}: {
  product?: AdminProduct
  categories: Category[]
  justCreated?: boolean
}) {
  const isEdit = Boolean(product)
  const [state, formAction] = useFormState(isEdit ? updateProduct : createProduct, initial)

  const [title, setTitle] = useState(product?.title ?? '')
  const [slug, setSlug] = useState(product?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug))
  const [story, setStory] = useState<StoryBlock[]>(product?.story_content ?? [])
  const [steps, setSteps] = useState<HowItWorksStep[]>(product?.how_it_works ?? [])

  const galleryDefaults = (product?.product_images ?? []).map((i) => i.image_url)
  const coverDefault = product?.preview_image_url ?? galleryDefaults[0] ?? null

  return (
    <form action={formAction} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={product!.id} />}
      <input type="hidden" name="story_content" value={JSON.stringify(story)} />
      <input type="hidden" name="how_it_works" value={JSON.stringify(steps)} />

      {(state.status !== 'idle' || justCreated) && (
        <div
          className={
            state.status === 'error'
              ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'
              : 'flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.status === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>
            {state.message ?? (justCreated ? 'Product created. Add the rest of the details below.' : 'Saved.')}
          </span>
        </div>
      )}

      {/* ------------------------------------------------------- basics */}
      <Card className="p-5">
        <h2 className="text-lg">The basics</h2>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                // Mirror the title into the slug until the admin edits it
                // directly — then stop, so their choice is never overwritten.
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              placeholder="The 90-Day Content Calendar"
              className="mt-1.5"
            />
            <FieldError message={state.fieldErrors?.title} />
          </div>

          <div>
            <Label htmlFor="slug">URL slug</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 font-heading text-xs text-brand-body/60">/products/</span>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                placeholder="90-day-content-calendar"
              />
            </div>
            {isEdit && (
              <p className="mt-1 text-xs text-amber-700">
                Changing this breaks any link already shared to the old URL.
              </p>
            )}
            <FieldError message={state.fieldErrors?.slug} />
          </div>

          <div>
            <Label htmlFor="short_description">Short description</Label>
            <Textarea
              id="short_description"
              name="short_description"
              rows={2}
              maxLength={300}
              defaultValue={product?.short_description ?? ''}
              placeholder="One or two sentences under the headline. Say what it is and who it's for."
              className="mt-1.5"
            />
            <FieldError message={state.fieldErrors?.short_description} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={product?.price ?? ''}
                placeholder="19.00"
                className="mt-1.5"
              />
              <FieldError message={state.fieldErrors?.price} />
            </div>
            <div>
              <Label htmlFor="compare_at_price">Compare-at price</Label>
              <Input
                id="compare_at_price"
                name="compare_at_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product?.compare_at_price ?? ''}
                placeholder="39.00"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-brand-body/70">Shown struck through.</p>
            </div>
            <div>
              <Label htmlFor="category_id">Category</Label>
              <Select
                id="category_id"
                name="category_id"
                defaultValue={product?.category_id ?? ''}
                className="mt-1.5"
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <input type="hidden" name="currency" value="USD" />
        </div>
      </Card>

      {/* --------------------------------------------------- deliverable */}
      <Card className="p-5">
        <h2 className="text-lg">The file</h2>
        <p className="mt-1 text-sm text-brand-body">
          Stored in a private bucket. Buyers only ever receive a link that expires.
        </p>

        <div className="mt-4 space-y-4">
          <ProductFileField
            name="file_url"
            defaultPath={product?.file_url}
            defaultType={product?.file_type}
            defaultSizeMb={product?.file_size_mb}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="file_type_display">Format label</Label>
              <Select
                id="file_type_display"
                defaultValue={product?.file_type ?? ''}
                className="mt-1.5"
                onChange={(e) => {
                  // The hidden file_type input owns the submitted value; this
                  // select overrides it when the extension guessed wrong.
                  const hidden = document.querySelector<HTMLInputElement>('input[name="file_type"]')
                  if (hidden) hidden.value = e.target.value
                }}
              >
                <option value="">Auto from upload</option>
                {FILE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------------- images */}
      <Card className="p-5">
        <h2 className="text-lg">Images</h2>
        <div className="mt-4">
          <ImageField
            label="Cover and gallery"
            hint="The first image is the cover — it appears on cards and as the hero. Add up to 8."
            multiple
            coverName="preview_image_url"
            galleryName="gallery"
            defaultCover={coverDefault}
            defaultGallery={galleryDefaults.filter((u) => u !== coverDefault)}
          />
        </div>
      </Card>

      {/* ------------------------------------------------ sales page copy */}
      <Card className="p-5">
        <h2 className="text-lg">Sales page</h2>
        <p className="mt-1 text-sm text-brand-body">
          These fields build the product page. Leave a section empty and it is left out entirely.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="announcement_text">Announcement bar (optional)</Label>
            <Input
              id="announcement_text"
              name="announcement_text"
              maxLength={160}
              defaultValue={product?.announcement_text ?? ''}
              placeholder="Launch week — 40% off through Sunday"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-brand-body/70">
              Thin bar across the very top. Leave blank to hide it.
            </p>
          </div>

          <div>
            <Label htmlFor="benefits">Benefits — one per line</Label>
            <Textarea
              id="benefits"
              name="benefits"
              rows={5}
              defaultValue={(product?.benefits ?? []).join('\n')}
              placeholder={
                'Plan a full quarter of content in one afternoon\nSwap in your own brand colours in two clicks\nWorks in Google Sheets and Excel'
              }
              className="mt-1.5 font-body"
            />
            <p className="mt-1 text-xs text-brand-body/70">
              These become the red-tick list beside the buy button. Four or five is the sweet spot.
            </p>
          </div>

          <div>
            <Label htmlFor="description">Long description (optional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={product?.description ?? ''}
              placeholder="Blank line between paragraphs."
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-brand-body/70">
              Only shown when there are no story blocks below.
            </p>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------- story blocks */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg">Story blocks</h2>
            <p className="mt-1 text-sm text-brand-body">
              Alternating copy and image down the page. This is where the pitch happens.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStory((s) => [...s, { heading: '', body: '', image_url: '' }])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add block
          </Button>
        </div>

        {story.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-border bg-brand-cream/40 p-4 text-sm text-brand-body">
            No story blocks yet. The long description above will be used instead.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {story.map((block, i) => (
              <li key={i} className="rounded-lg border border-border bg-brand-cream/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-brand-body">
                    <GripVertical className="h-3.5 w-3.5" aria-hidden />
                    Block {i + 1}
                    <span className="font-normal normal-case tracking-normal text-brand-body/60">
                      · image {i % 2 === 0 ? 'right' : 'left'}
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <MoveButtons
                      index={i}
                      length={story.length}
                      onMove={(from, to) => setStory((s) => move(s, from, to))}
                    />
                    <button
                      type="button"
                      onClick={() => setStory((s) => s.filter((_, idx) => idx !== i))}
                      className="rounded p-1 text-brand-body/60 hover:text-red-600"
                      aria-label={`Remove block ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <Input
                    value={block.heading ?? ''}
                    onChange={(e) =>
                      setStory((s) => patch(s, i, { heading: e.target.value }))
                    }
                    placeholder="“It just makes my life easier, period.”"
                  />
                  <Textarea
                    value={block.body ?? ''}
                    onChange={(e) => setStory((s) => patch(s, i, { body: e.target.value }))}
                    rows={4}
                    placeholder="Blank line between paragraphs."
                  />
                  <InlineImageField
                    value={block.image_url}
                    onChange={(url) => setStory((s) => patch(s, i, { image_url: url }))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --------------------------------------------------- how it works */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg">What you get / how it works</h2>
            <p className="mt-1 text-sm text-brand-body">
              Numbered cards on the cream band. Three works best.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSteps((s) => [...s, { step_number: s.length + 1, title: '', caption: '', image_url: '' }])
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add step
          </Button>
        </div>

        {steps.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-border bg-brand-cream/40 p-4 text-sm text-brand-body">
            No steps yet — the section will be hidden.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="rounded-lg border border-border bg-brand-cream/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body">
                    Step {i + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <MoveButtons
                      index={i}
                      length={steps.length}
                      onMove={(from, to) => setSteps((s) => move(s, from, to))}
                    />
                    <button
                      type="button"
                      onClick={() => setSteps((s) => s.filter((_, idx) => idx !== i))}
                      className="rounded p-1 text-brand-body/60 hover:text-red-600"
                      aria-label={`Remove step ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <Input
                    value={step.title ?? ''}
                    onChange={(e) => setSteps((s) => patch(s, i, { title: e.target.value }))}
                    placeholder="Download the file"
                  />
                  <Textarea
                    value={step.caption ?? ''}
                    onChange={(e) => setSteps((s) => patch(s, i, { caption: e.target.value }))}
                    rows={2}
                    placeholder="A short line explaining this step."
                  />
                  <InlineImageField
                    value={step.image_url}
                    onChange={(url) => setSteps((s) => patch(s, i, { image_url: url }))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------------------------------------------- publishing */}
      <Card className="p-5">
        <h2 className="text-lg">Publishing</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              defaultValue={product?.status ?? 'draft'}
              className="mt-1.5"
            >
              <option value="draft">Draft — hidden from the store</option>
              <option value="active">Active — live and buyable</option>
              <option value="archived">Archived — hidden, kept for records</option>
            </Select>
          </div>

          <label className="flex items-start gap-2.5 self-end rounded-md border border-border bg-brand-cream/40 p-3">
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={product?.is_featured ?? false}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#EB2437]"
            />
            <span className="text-sm text-brand-body">
              <span className="font-heading font-bold uppercase tracking-wide text-brand-heading">
                Feature it
              </span>
              <br />
              Puts it in the homepage featured row.
            </span>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton isEdit={isEdit} />
        {isEdit && product!.status === 'active' && (
          <Button asChild variant="outline" size="md">
            <Link href={`/products/${product!.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" aria-hidden />
              View live page
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="md">
          <Link href="/admin/products">Back to products</Link>
        </Button>
      </div>
    </form>
  )
}

/** Immutable helpers — the hidden JSON inputs re-render off these arrays. */
function patch<T>(list: T[], index: number, changes: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...changes } : item))
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function MoveButtons({
  index,
  length,
  onMove,
}: {
  index: number
  length: number
  onMove: (from: number, to: number) => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        className="rounded px-1 font-heading text-xs font-bold text-brand-body/60 hover:text-brand-cta disabled:opacity-30"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === length - 1}
        className="rounded px-1 font-heading text-xs font-bold text-brand-body/60 hover:text-brand-cta disabled:opacity-30"
        aria-label="Move down"
      >
        ↓
      </button>
    </>
  )
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
    </Button>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-red-600">{message}</p>
}
