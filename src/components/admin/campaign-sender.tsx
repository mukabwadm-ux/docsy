'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, Pause, Play, RotateCcw, Send } from 'lucide-react'
import {
  pauseCampaign,
  resumeCampaign,
  retryFailed,
  sendNextBatch,
  startCampaign,
} from '@/actions/campaigns'
import { Button } from '@/components/ui/button'
import type { CampaignProgress, CampaignStatus } from '@/lib/campaigns'

/**
 * Drives the send.
 *
 * The loop lives in the browser, calling one server action per batch, because a
 * serverless request has a hard execution limit and a list of any size cannot be
 * sent inside one invocation. Each call is independently safe: the queue is in the
 * database, so a closed tab or a dropped connection pauses the run rather than
 * corrupting it, and reopening the page resumes exactly where it stopped.
 */
export function CampaignSender({
  campaignId,
  status,
  progress: initialProgress,
  mailReady,
  mailHint,
}: {
  campaignId: string
  status: CampaignStatus
  progress: CampaignProgress
  mailReady: boolean
  mailHint: string
}) {
  const router = useRouter()
  const [progress, setProgress] = useState(initialProgress)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)

  // Set when the operator pauses mid-run, so the loop stops after the current
  // batch rather than being killed halfway through a send.
  const stopRequested = useRef(false)

  const runLoop = useCallback(async () => {
    setRunning(true)
    setError(null)
    stopRequested.current = false

    // Hard ceiling on iterations. A bug that never reports `done` would otherwise
    // loop forever, and 400 batches is far more than any list this shop will have.
    for (let i = 0; i < 400; i++) {
      if (stopRequested.current) {
        setMessage('Stopped. Pending recipients keep their place in the queue.')
        break
      }

      const result = await sendNextBatch(campaignId)

      if (result.status === 'error') {
        setError(result.message ?? 'Sending failed.')
        break
      }

      if (result.progress) {
        setProgress((p) => ({
          queued: p.queued,
          sent: p.sent + result.progress!.sent,
          failed: p.failed + result.progress!.failed,
          pending: result.progress!.remaining,
        }))
        setMessage(result.message ?? null)
        if (result.progress.done) break
      }

      // A short gap between batches. Mail servers rate-limit, and hammering one
      // is how an account gets throttled or suspended mid-campaign.
      await new Promise((r) => setTimeout(r, 700))
    }

    setRunning(false)
    router.refresh()
  }, [campaignId, router])

  async function begin() {
    setError(null)
    setArmed(false)
    const started = await startCampaign(campaignId)
    if (started.status === 'error') {
      setError(started.message ?? 'Could not start.')
      return
    }
    setMessage(started.message ?? null)
    if (started.progress) {
      setProgress((p) => ({ ...p, pending: started.progress!.remaining }))
    }
    await runLoop()
  }

  const percent =
    progress.queued > 0
      ? Math.round(((progress.sent + progress.failed) / progress.queued) * 100)
      : 0

  const finished = status === 'sent' && progress.pending === 0

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg">Sending</h2>
          <p className="mt-1 text-sm text-brand-body">
            {finished
              ? 'This campaign has finished sending.'
              : progress.queued === 0
                ? 'Nothing queued yet. Starting will snapshot the audience and begin.'
                : `${progress.pending} of ${progress.queued} still to go.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!finished && progress.pending === 0 && progress.queued === 0 && (
            <>
              {!armed ? (
                <Button
                  variant="cta"
                  size="md"
                  onClick={() => setArmed(true)}
                  disabled={!mailReady || running}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Send campaign
                </Button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Button variant="cta" size="md" onClick={begin} disabled={running}>
                    {running && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Yes, send it now
                  </Button>
                  <button
                    type="button"
                    onClick={() => setArmed(false)}
                    className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body/60 hover:text-brand-heading"
                  >
                    Cancel
                  </button>
                </span>
              )}
            </>
          )}

          {progress.pending > 0 && !running && (
            <Button variant="cta" size="md" onClick={runLoop} disabled={!mailReady}>
              <Play className="h-4 w-4" aria-hidden />
              {status === 'paused' ? 'Resume sending' : 'Continue sending'}
            </Button>
          )}

          {running && (
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                stopRequested.current = true
                void pauseCampaign(campaignId)
              }}
            >
              <Pause className="h-4 w-4" aria-hidden />
              Pause
            </Button>
          )}

          {progress.failed > 0 && !running && (
            <Button
              variant="outline"
              size="md"
              onClick={async () => {
                const r = await retryFailed(campaignId)
                setMessage(r.message ?? null)
                router.refresh()
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Retry {progress.failed} failed
            </Button>
          )}

          {status === 'paused' && !running && progress.pending > 0 && (
            <button
              type="button"
              onClick={async () => {
                await resumeCampaign(campaignId)
                router.refresh()
              }}
              className="font-heading text-xs font-bold uppercase tracking-wider text-brand-cta hover:underline"
            >
              Mark as sending
            </button>
          )}
        </div>
      </div>

      {!mailReady && (
        <p className="mt-4 rounded-md border border-brand-tan bg-brand-cream p-3 text-sm text-brand-body">
          {mailHint}
        </p>
      )}

      {progress.queued > 0 && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-brand-cream">
            <div
              className="h-full rounded-full bg-brand-cta transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-heading text-xs font-bold uppercase tracking-wide">
            <span className="text-brand-heading">{progress.sent} sent</span>
            {progress.failed > 0 && <span className="text-brand-cta">{progress.failed} failed</span>}
            <span className="text-brand-body/70">{progress.pending} pending</span>
            <span className="text-brand-body/50">{percent}%</span>
          </div>
        </div>
      )}

      {running && (
        <p className="mt-3 flex items-center gap-2 text-sm text-brand-body">
          <Loader2 className="h-4 w-4 animate-spin text-brand-cta" aria-hidden />
          Sending in batches — keep this tab open. Closing it pauses the run; nothing is lost.
        </p>
      )}

      {message && !running && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4" aria-hidden />
          {message}
        </p>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
