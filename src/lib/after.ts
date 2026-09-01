import 'server-only'

import { waitUntil } from '@vercel/functions'

/**
 * Runs work after the response has been sent, without the visitor waiting for it.
 *
 * Sending an email inline is the reason checkout felt slow: an SMTP handshake and
 * send takes around five seconds, and the buyer sat on a spinner for all of it
 * before being redirected — for a message they read later, in a different tab.
 *
 * Firing the promise loose is not a safe alternative, however tempting: a
 * serverless function can be frozen or torn down the moment its response is
 * returned, so an unawaited send is silently lost some fraction of the time. That
 * is worse than slow — the buyer's confirmation and resume link simply never
 * arrive, and nothing records that they didn't.
 *
 * waitUntil hands the promise to the platform, which keeps the invocation alive
 * until it settles. Off Vercel there is no such contract, but there is also no
 * teardown: a long-lived dev or self-hosted process finishes the promise on its
 * own, so the fallback is simply to leave it running.
 *
 * Use this only for work whose result the response does not depend on, and make
 * sure the promise handles its own errors — nothing here can report them.
 */
export function afterResponse(work: Promise<unknown>): void {
  try {
    waitUntil(work)
  } catch {
    // No request context (local dev, a script, a test). The promise is already
    // running; the process will outlive it.
    void work
  }
}
