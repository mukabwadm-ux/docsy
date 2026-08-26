import 'server-only'

import { createAdminClient } from './supabase/admin'
import { sendMail, activeTransport } from './mailer'
import { campaignEmail } from './email-templates'

export type CampaignAudience = 'all' | 'purchased' | 'no-purchase'
export type CampaignStatus = 'draft' | 'sending' | 'paused' | 'sent' | 'failed'

export interface Campaign {
  id: string
  name: string
  subject: string
  heading: string
  intro: string
  bullets: string[]
  cta_label: string
  cta_url: string
  audience: CampaignAudience
  status: CampaignStatus
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface CampaignProgress {
  queued: number
  sent: number
  failed: number
  pending: number
}

/**
 * How many recipients to attempt per invocation.
 *
 * Deliberately small. A serverless function has a hard execution limit — 60s on
 * Vercel's default — and an SMTP round trip can take a second or more under load.
 * Twenty is comfortably inside the budget even on a slow mail server, and the
 * client simply calls again until the queue is empty. Raising this trades
 * resumability for a shorter wall-clock time, and a run that dies at the timeout
 * is far worse than one that takes three requests.
 */
export const BATCH_SIZE = 20

export const AUDIENCE_LABEL: Record<CampaignAudience, string> = {
  all: 'Everyone with an account',
  purchased: 'People who have bought',
  'no-purchase': 'Accounts with no purchase',
}

// ------------------------------------------------------------------- reading

export async function listCampaigns(): Promise<(Campaign & CampaignProgress)[]> {
  const db = createAdminClient()
  const [{ data: campaigns }, { data: sends }] = await Promise.all([
    db.from('campaigns').select('*').order('created_at', { ascending: false }),
    db.from('campaign_sends').select('campaign_id, status'),
  ])

  const tally = new Map<string, CampaignProgress>()
  for (const s of (sends as { campaign_id: string; status: string }[]) ?? []) {
    const t = tally.get(s.campaign_id) ?? { queued: 0, sent: 0, failed: 0, pending: 0 }
    t.queued += 1
    if (s.status === 'sent') t.sent += 1
    else if (s.status === 'failed') t.failed += 1
    else t.pending += 1
    tally.set(s.campaign_id, t)
  }

  return ((campaigns as Campaign[]) ?? []).map((c) => ({
    ...c,
    bullets: Array.isArray(c.bullets) ? c.bullets : [],
    ...(tally.get(c.id) ?? { queued: 0, sent: 0, failed: 0, pending: 0 }),
  }))
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data } = await createAdminClient().from('campaigns').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const c = data as Campaign
  return { ...c, bullets: Array.isArray(c.bullets) ? c.bullets : [] }
}

export async function getProgress(campaignId: string): Promise<CampaignProgress> {
  const { data } = await createAdminClient()
    .from('campaign_sends')
    .select('status')
    .eq('campaign_id', campaignId)

  const rows = (data as { status: string }[]) ?? []
  return {
    queued: rows.length,
    sent: rows.filter((r) => r.status === 'sent').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    pending: rows.filter((r) => r.status === 'pending').length,
  }
}

/** Recipients, newest attempt first, for the campaign detail page. */
export async function getRecipients(campaignId: string, limit = 200) {
  const { data } = await createAdminClient()
    .from('campaign_sends')
    .select('id, email, status, error, sent_at, created_at')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  return (data as {
    id: string
    email: string
    status: 'pending' | 'sent' | 'failed'
    error: string | null
    sent_at: string | null
    created_at: string
  }[]) ?? []
}

/**
 * What a send would reach right now, without queueing.
 *
 * Also returns a handful of addresses: a count alone does not catch "this is
 * pointing at the wrong segment", but seeing three real recipients does.
 */
export async function dryRun(audience: CampaignAudience) {
  const db = createAdminClient()
  const [{ data: size }, { data: sample }] = await Promise.all([
    db.rpc('campaign_audience_size', { p_audience: audience }),
    db
      .from('campaign_audience')
      .select('email, has_purchased')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const rows = (sample as { email: string; has_purchased: boolean }[]) ?? []
  const filtered = rows.filter((r) =>
    audience === 'all' ? true : audience === 'purchased' ? r.has_purchased : !r.has_purchased
  )

  return {
    recipients: Number(size ?? 0),
    sample: filtered.slice(0, 5).map((r) => r.email),
    transport: await activeTransport(),
  }
}

// ------------------------------------------------------------------- sending

/**
 * Sends the next batch, and reports what is left.
 *
 * Each recipient's own unsubscribe token goes into their own email. Reusing one
 * token across a campaign would mean a single opt-out unsubscribing whoever the
 * token belonged to, not the person who clicked — so the token is fetched per
 * recipient and a missing one is a hard skip rather than a send without an
 * opt-out link.
 */
export async function sendBatch(campaignId: string): Promise<
  | { ok: true; attempted: number; sent: number; failed: number; remaining: number; done: boolean }
  | { ok: false; error: string }
> {
  const db = createAdminClient()

  const campaign = await getCampaign(campaignId)
  if (!campaign) return { ok: false, error: 'Campaign not found.' }
  if (campaign.status === 'paused') return { ok: false, error: 'This campaign is paused.' }

  const { data: batch } = await db
    .from('campaign_sends')
    .select('id, user_id, email')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at')
    .limit(BATCH_SIZE)

  const rows = (batch as { id: string; user_id: string; email: string }[]) ?? []

  // Nothing pending: either the campaign never had recipients, or the last batch
  // finished it. Either way the run is over.
  if (rows.length === 0) {
    await finish(campaignId)
    return { ok: true, attempted: 0, sent: 0, failed: 0, remaining: 0, done: true }
  }

  // One lookup for the batch's tokens rather than one per recipient.
  const { data: profiles } = await db
    .from('buyer_profiles')
    .select('id, unsubscribe_token, marketing_opt_in, unsubscribed_at')
    .in('id', rows.map((r) => r.user_id))

  const byUser = new Map(
    ((profiles as {
      id: string
      unsubscribe_token: string
      marketing_opt_in: boolean
      unsubscribed_at: string | null
    }[]) ?? []).map((p) => [p.id, p])
  )

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const profile = byUser.get(row.user_id)

    /**
     * Re-check consent at the moment of sending, not just when the audience was
     * snapshotted. Somebody who unsubscribed after the queue was built must not
     * receive the campaign — the gap between queueing and sending can be minutes.
     */
    if (!profile || !profile.marketing_opt_in || profile.unsubscribed_at) {
      await db
        .from('campaign_sends')
        .update({ status: 'failed', error: 'Recipient opted out before sending' })
        .eq('id', row.id)
      failed += 1
      continue
    }

    if (!profile.unsubscribe_token) {
      await db
        .from('campaign_sends')
        .update({ status: 'failed', error: 'No unsubscribe token; not sent' })
        .eq('id', row.id)
      failed += 1
      continue
    }

    const message = campaignEmail({
      heading: campaign.heading,
      intro: campaign.intro,
      bullets: campaign.bullets,
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      unsubscribeToken: profile.unsubscribe_token,
    })

    /**
     * No owner copy here, deliberately. A campaign to two hundred people would
     * put two hundred copies in the owner's inbox, and on a shared mailbox it
     * would leak the entire recipient list. Only transactional mail is copied.
     */
    const result = await sendMail({
      to: row.email,
      // The campaign's own subject wins over the template's derived one.
      subject: campaign.subject || message.subject,
      html: message.html,
      text: message.text,
    })

    if (result.ok) {
      await db
        .from('campaign_sends')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', row.id)
      sent += 1
    } else {
      /**
       * Recorded as failed, not left pending. A pending row would be retried on
       * the next batch, and a permanent failure — a rejected address, a bad
       * key — would retry forever. Retrying is a deliberate action instead.
       */
      await db
        .from('campaign_sends')
        .update({ status: 'failed', error: result.error.slice(0, 500) })
        .eq('id', row.id)
      failed += 1
    }
  }

  const progress = await getProgress(campaignId)
  const done = progress.pending === 0
  if (done) await finish(campaignId)

  return {
    ok: true,
    attempted: rows.length,
    sent,
    failed,
    remaining: progress.pending,
    done,
  }
}

async function finish(campaignId: string) {
  const progress = await getProgress(campaignId)
  await createAdminClient()
    .from('campaigns')
    .update({
      // "sent" even with some failures — the run completed. A campaign is only
      // "failed" when nothing got through, which points at configuration rather
      // than at individual addresses.
      status: progress.sent === 0 && progress.failed > 0 ? 'failed' : 'sent',
      completed_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
}
