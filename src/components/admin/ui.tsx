import Link from 'next/link'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-brand-body">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-border bg-white shadow-card', className)}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  href,
  accent = false,
}: {
  label: string
  value: string | number
  hint?: string
  href?: string
  /** Draws attention to a number that means work is waiting. */
  accent?: boolean
}) {
  const body = (
    <>
      <p className="font-heading text-xs font-bold uppercase tracking-wider text-brand-body/70">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 font-heading text-3xl font-bold leading-none',
          accent ? 'text-brand-cta' : 'text-brand-heading'
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-brand-body/70">{hint}</p>}
    </>
  )

  const classes = cn(
    'block rounded-lg border bg-white p-5 shadow-card transition-colors',
    accent ? 'border-brand-cta/30' : 'border-border',
    href && 'hover:border-brand-cta'
  )

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-brand-cream/40 px-6 py-14 text-center">
      <p className="font-heading text-lg font-bold uppercase tracking-wide text-brand-heading">
        {title}
      </p>
      {hint && <p className="mt-1.5 max-w-md text-sm text-brand-body">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-800 border-green-200',
  draft: 'bg-amber-50 text-amber-800 border-amber-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
  approved: 'bg-green-50 text-green-800 border-green-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  delivered: 'bg-green-50 text-green-800 border-green-200',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wider',
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'
      )}
    >
      {status}
    </span>
  )
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-card">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-border bg-brand-cream/50 px-4 py-3 font-heading text-[11px] font-bold uppercase tracking-wider text-brand-body',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('border-b border-border px-4 py-3 align-middle', className)}>{children}</td>
}
