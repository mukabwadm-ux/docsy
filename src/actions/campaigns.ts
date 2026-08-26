'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { assertAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  dryRun,
  getCampaign,
  getProgress,
  sendBatch,
  type CampaignAudience,
} from '@/lib/campaigns'
import { isMailConfigured, mailSetupHint } from '@/lib/mailer'

export interface CampaignState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
  /** Batch progress, for the client's send loop. */
  progress?: { sent: number; failed: number; remaining: number; done: boolean }
  /** Dry-run result. */
  preview?: { recipients: number; sample: string[]; transport: string }
}

const DENIED: CampaignState = { status: 'error', message: 'You are not signed in as an admin.' }

const schema = z.object({
  name: z.string().trim().min(2, 'Give the campaign a name.').max(120),
  subject: z.string().trim().min(3, 'Write a subject line.').max(160),
  heading: z.string().trim().min(3, 'Write a heading.').max(120),
  intro: z.string().trim().min(10, 'Write an opening paragraph.').max(1200),
  bullets: z
    .string()
    .optional()
    .transform((raw) =>
      (raw ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 8)
    ),
  cta_label: z.string().trim().min(2).max(40).default('Browse the shop'),
  cta_url: z.string().trim().url('Enter a full URL, including https://').max(400),
  audience: z.enum(['all', 'purchased', 'no-purchase']),
})

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get('name'),
    subject: formData.get('subject'),
    heading: formData.get('heading'),
    intro: formData.get('intro'),
    bullets: formData.get('bullets') || undefined,
    cta_label: formData.get('cta_label') || 'Browse the shop',
    cta_url: formData.get('cta_url'),
    audience: formData.get('audience') || 'all',
  })
}

export async function createCampaign(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const parsed = parse(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    return { status: 'error', fieldErrors, message: 'Check the fields below.' }
  }

  const { data, error } = await createAdminClient()
    .from('campaigns')
    .insert({ ...parsed.data, created_by: session.userId, status: 'draft' })
    .select('id')
    .single()

  if (error) return { status: 'error', message: error.message }

  revalidatePath('/admin/campaigns')
  redirect(`/admin/campaigns/${data.id}`)
}

export async function updateCampaign(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const id = String(formData.get('id') ?? '')
  const campaign = await getCampaign(id)
  if (!campaign) return { status: 'error', message: 'Campaign not found.' }

  /**
   * Content is frozen once a send starts. Editing mid-run would mean two
   * different emails going out under one campaign, and no way to tell from the
   * record which recipient got which.
   */
  if (campaign.status !== 'draft') {
    return {
      status: 'error',
      message: 'This campaign has already started sending, so its content is locked.',
    }
  }

  const parsed = parse(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    return { status: 'error', fieldErrors, message: 'Check the fields below.' }
  }

  const { error } = await createAdminClient().from('campaigns').update(parsed.data).eq('id', id)
  if (error) return { status: 'error', message: error.message }

  revalidatePath(`/admin/campaigns/${id}`)
  return { status: 'success', message: 'Saved.' }
}

/** Counts the audience without queueing or sending anything. */
export async function previewAudience(audience: CampaignAudience): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const preview = await dryRun(audience)
  return {
    status: 'success',
    preview,
    message:
      preview.recipients === 0
        ? 'Nobody is in this segment yet, so there is nothing to send.'
        : `${preview.recipients} ${preview.recipients === 1 ? 'person' : 'people'} would receive this.`,
  }
}

/**
 * Snapshots the audience into campaign_sends and marks the campaign as sending.
 *
 * Separated from the sending itself so the queue exists before a single message
 * goes out. If anything fails after this point, the record of who was meant to
 * receive it is already durable.
 */
export async function startCampaign(campaignId: string): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  if (!(await isMailConfigured())) {
    return { status: 'error', message: mailSetupHint() }
  }

  const campaign = await getCampaign(campaignId)
  if (!campaign) return { status: 'error', message: 'Campaign not found.' }
  if (campaign.status === 'sent') {
    return { status: 'error', message: 'This campaign has already been sent.' }
  }

  const db = createAdminClient()
  const { data: added, error } = await db.rpc('queue_campaign', { p_campaign_id: campaignId })
  if (error) return { status: 'error', message: error.message }

  const progress = await getProgress(campaignId)
  if (progress.queued === 0) {
    return { status: 'error', message: 'Nobody is in this segment, so nothing was queued.' }
  }

  await db
    .from('campaigns')
    .update({ status: 'sending', started_at: campaign.started_at ?? new Date().toISOString() })
    .eq('id', campaignId)

  revalidatePath(`/admin/campaigns/${campaignId}`)
  return {
    status: 'success',
    message: `${progress.pending} queued${Number(added) !== progress.pending ? ` (${added} newly added)` : ''}.`,
    progress: { sent: progress.sent, failed: progress.failed, remaining: progress.pending, done: false },
  }
}

/**
 * Sends one batch. The client calls this repeatedly until `done`.
 *
 * Batching is driven from the browser rather than looped here because a
 * serverless request has a hard time limit — a list of any size cannot be sent in
 * one invocation, and a run killed at the timeout would leave the queue in an
 * unclear state.
 */
export async function sendNextBatch(campaignId: string): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const result = await sendBatch(campaignId)
  if (!result.ok) return { status: 'error', message: result.error }

  revalidatePath(`/admin/campaigns/${campaignId}`)
  return {
    status: 'success',
    message: result.done
      ? 'Finished.'
      : `${result.sent} sent, ${result.remaining} to go.`,
    progress: {
      sent: result.sent,
      failed: result.failed,
      remaining: result.remaining,
      done: result.done,
    },
  }
}

export async function pauseCampaign(campaignId: string): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  await createAdminClient().from('campaigns').update({ status: 'paused' }).eq('id', campaignId)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { status: 'success', message: 'Paused. Pending recipients keep their place in the queue.' }
}

export async function resumeCampaign(campaignId: string): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  await createAdminClient().from('campaigns').update({ status: 'sending' }).eq('id', campaignId)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { status: 'success', message: 'Resumed.' }
}

/** Re-queues only the failures, leaving successful sends alone. */
export async function retryFailed(campaignId: string): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_sends')
    .update({ status: 'pending', error: null })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')

  if (error) return { status: 'error', message: error.message }

  await db.from('campaigns').update({ status: 'sending', completed_at: null }).eq('id', campaignId)
  revalidatePath(`/admin/campaigns/${campaignId}`)

  const progress = await getProgress(campaignId)
  return {
    status: 'success',
    message: `${progress.pending} recipient${progress.pending === 1 ? '' : 's'} re-queued.`,
  }
}

export async function deleteCampaign(campaignId: string): Promise<CampaignState> {
  const session = await assertAdmin()
  if (!session) return DENIED

  const campaign = await getCampaign(campaignId)
  if (!campaign) return { status: 'error', message: 'Campaign not found.' }

  // The send record is the only evidence of who was emailed; deleting it would
  // lose that, and the campaign cannot be un-sent anyway.
  if (campaign.status === 'sending') {
    return { status: 'error', message: 'Pause the campaign before deleting it.' }
  }

  const { error } = await createAdminClient().from('campaigns').delete().eq('id', campaignId)
  if (error) return { status: 'error', message: error.message }

  revalidatePath('/admin/campaigns')
  redirect('/admin/campaigns')
}
