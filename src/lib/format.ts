/**
 * Docsy sells internationally and prices in USD, so formatting is en-US with
 * cents shown. Digital prices land on .99 and .00 far more often than round
 * numbers, and dropping the cents would turn $19.99 into $20 — the exact
 * opposite of what the price was chosen to signal.
 */
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(value: number | null | undefined, currency = 'USD') {
  if (value === null || value === undefined) return '—'
  if (currency !== 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return usd.format(value)
}

/** "Free" reads better than "$0.00" on a lead magnet. */
export function formatPriceOrFree(value: number | null | undefined, currency = 'USD') {
  if (value === 0) return 'Free'
  return formatPrice(value, currency)
}

export function formatCompact(n: number) {
  if (n < 1000) return String(n)
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return formatDate(iso)
}

export function fileTypeLabel(t: string | null | undefined) {
  if (!t) return 'Digital download'
  const map: Record<string, string> = {
    pdf: 'PDF',
    zip: 'ZIP bundle',
    figma: 'Figma file',
    canva: 'Canva template',
    notion: 'Notion template',
    xlsx: 'Excel workbook',
    docx: 'Word document',
    epub: 'EPUB',
  }
  return map[t.toLowerCase()] ?? t.toUpperCase()
}

export function formatFileSize(mb: number | null | undefined) {
  if (!mb) return null
  if (mb < 1) return `${Math.round(mb * 1024)} KB`
  return `${Number(mb).toFixed(1)} MB`
}

/** Percentage off, for the struck-through anchor price. Null when not a saving. */
export function discountPercent(price: number, compareAt: number | null | undefined) {
  if (!compareAt || compareAt <= price) return null
  return Math.round(((compareAt - price) / compareAt) * 100)
}
