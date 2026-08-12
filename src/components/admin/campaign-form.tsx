'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Check, Loader2, Users } from 'lucide-react'
import {
  createCampaign,
  previewAudience,
  updateCampaign,
  type CampaignState,
} from '@/actions/campaigns'
import { Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import type { CampaignAudience } from '@/lib/campaigns'

const initial: CampaignState = { status: 'idle' }

const AUDIENCES: { value: CampaignAudience; label: string; hint: string }[] = [
  { value: 'all', label: 'Everyone with an account', hint: 'Buyers and browsers alike.' },
  {
    value: 'purchased',
    label: 'People who have bought',
    hint: 'They already trust the shop — good for new releases.',
  },
  {
    value: 'no-purchase',
    label: 'Accounts with no purchase',
    hint: 'Never bought anything. Lead with something free.',
  },
]

export interface CampaignDefaults {
  id?: string
  name?: string
  subject?: string
  heading?: string
  intro?: string
  bullets?: string[]
  cta_label?: string
  cta_url?: string
  audience?: CampaignAudience
}

export function CampaignForm({
  defaults = {},
  presets = [],
  locked = false,
}: {
  defaults?: CampaignDefaults
  presets?: { key: string; label: string }[]
  /** True once sending has begun; content is frozen at that point. */
  locked?: boolean
}) {
  const isEdit = Boolean(defaults.id)
  const [state, formAction] = useFormState(isEdit ? updateCampaign : createCampaign, initial)
  const [audience, setAudience] = useState<CampaignAudience>(defaults.audience ?? 'all')

  // The dry run is its own action so it can be checked without saving anything.
  const [preview, setPreview] = useState<CampaignState['preview'] | null>(null)
  const [previewMsg, setPreviewMsg] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()

  function checkAudience() {
    setPreview(null)
    startCheck(async () => {
      const result = await previewAudience(audience)
      setPreview(result.preview ?? null)
      setPreviewMsg(result.message ?? null)
    })
  }

  return (
    <form action={formAction} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      {presets.length > 0 && !isEdit && (
        <Card className="p-4">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
            Start from a template
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <Link
                key={p.key}
                href={`/admin/campaigns/new?preset=${p.key}`}
                className="rounded-full border border-border bg-white px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-body hover:border-brand-cta hover:text-brand-cta"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {state.status === 'error' && state.message && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      {state.status === 'success' && state.message && (
        <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
          <Check className="h-4 w-4" aria-hidden />
          {state.message}
        </p>
      )}

      <Card className="p-5">
        <h2 className="text-lg">Who it goes to</h2>

        <div className="mt-4 space-y-2">
          {AUDIENCES.map((a) => (
            <label
              key={a.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-white p-3 has-[:checked]:border-brand-cta has-[:checked]:bg-brand-cream/40"
            >
              <input
                type="radio"
                name="audience"
                value={a.value}
                defaultChecked={audience === a.value}
                onChange={() => {
                  setAudience(a.value)
                  setPreview(null)
                  setPreviewMsg(null)
                }}
                disabled={locked}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#EB2437]"
              />
              <span className="text-sm">
                <span className="font-heading font-bold uppercase tracking-wide text-brand-heading">
                  {a.label}
                </span>
                <br />
                <span className="text-brand-body">{a.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={checkAudience} disabled={checking}>
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Users className="h-3.5 w-3.5" aria-hidden />
            )}
            Check who would receive this
          </Button>
          {previewMsg && (
            <span className="text-sm text-brand-body">
              {previewMsg}
              {preview?.sample.length ? ` e.g. ${preview.sample.slice(0, 3).join(', ')}` : ''}
            </span>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg">The email</h2>
        {locked && (
          <p className="mt-1 text-sm text-amber-700">
            Sending has started, so the content is locked — two different emails under one campaign
            would make the send record meaningless.
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Campaign name (internal)</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={defaults.name}
                placeholder="August new release"
                disabled={locked}
                className="mt-1.5"
              />
              {state.fieldErrors?.name && (
                <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="subject">Subject line</Label>
              <Input
                id="subject"
                name="subject"
                required
                maxLength={160}
                defaultValue={defaults.subject}
                placeholder="Something new in the shop"
                disabled={locked}
                className="mt-1.5"
              />
              {state.fieldErrors?.subject && (
                <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.subject}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="heading">Heading</Label>
            <Input
              id="heading"
              name="heading"
              required
              maxLength={120}
              defaultValue={defaults.heading}
              placeholder="Something new in the shop"
              disabled={locked}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-brand-body/70">
              The big Oswald line at the top of the email.
            </p>
            {state.fieldErrors?.heading && (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.heading}</p>
            )}
          </div>

          <div>
            <Label htmlFor="intro">Opening paragraph</Label>
            <Textarea
              id="intro"
              name="intro"
              required
              rows={4}
              maxLength={1200}
              defaultValue={defaults.intro}
              disabled={locked}
              className="mt-1.5"
            />
            {state.fieldErrors?.intro && (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.intro}</p>
            )}
          </div>

          <div>
            <Label htmlFor="bullets">Bullet points — one per line (optional)</Label>
            <Textarea
              id="bullets"
              name="bullets"
              rows={3}
              defaultValue={(defaults.bullets ?? []).join('\n')}
              placeholder={'Ready to use the moment you download it\nYours to keep, with free updates'}
              disabled={locked}
              className="mt-1.5"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cta_label">Button text</Label>
              <Input
                id="cta_label"
                name="cta_label"
                maxLength={40}
                defaultValue={defaults.cta_label ?? 'Browse the shop'}
                disabled={locked}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cta_url">Button link</Label>
              <Input
                id="cta_url"
                name="cta_url"
                type="url"
                required
                defaultValue={defaults.cta_url}
                placeholder="https://docsy.imprinnt.co/products"
                disabled={locked}
                className="mt-1.5"
              />
              {state.fieldErrors?.cta_url && (
                <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.cta_url}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton isEdit={isEdit} />
          <Button asChild variant="ghost" size="md">
            <Link href="/admin/campaigns">Cancel</Link>
          </Button>
          <span className="text-xs text-brand-body/70">
            Saving does not send anything.
          </span>
        </div>
      )}
    </form>
  )
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="lg" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save as draft'}
    </Button>
  )
}
