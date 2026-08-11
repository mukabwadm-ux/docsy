import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getEmailSample } from '@/lib/email-samples'

export const dynamic = 'force-dynamic'

/**
 * The HTML goes into an iframe via srcDoc rather than into the page.
 *
 * Email markup is a whole document with its own body background and table
 * layout; injected inline it would inherit the admin panel's CSS and fight with
 * it, so the preview would look nothing like the email. The iframe also lets the
 * web fonts load exactly as they would in a mail client.
 */
export default async function EmailPreviewPage({ params }: { params: { key: string } }) {
  await requireAdmin()
  const sample = getEmailSample(params.key)
  if (!sample) notFound()

  return (
    <>
      <PageHeader
        title={sample.label}
        subtitle={`${sample.audience} · ${sample.when}`}
        action={
          <Link
            href="/admin/emails"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 font-heading text-xs font-bold uppercase tracking-wide text-brand-heading hover:border-brand-cta hover:text-brand-cta"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All emails
          </Link>
        }
      />

      <div className="rounded-lg border border-border bg-white p-4 shadow-card">
        <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-body/70">
          Subject
        </p>
        <p className="mt-1 text-brand-heading">{sample.subject}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <iframe
          title={`${sample.label} preview`}
          srcDoc={sample.html}
          className="h-[820px] w-full bg-white"
          // Scripts blocked; remote styles allowed so the Oswald/Lora webfonts
          // render as they will in Apple Mail.
          sandbox="allow-same-origin"
        />
      </div>

      <details className="mt-4 rounded-lg border border-border bg-white p-4">
        <summary className="cursor-pointer font-heading text-xs font-bold uppercase tracking-wide text-brand-heading">
          Plain-text version
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-body text-sm text-brand-body">{sample.text}</pre>
      </details>
    </>
  )
}
