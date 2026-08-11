'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Check, FileUp, ImageUp, Loader2, X } from 'lucide-react'
import { uploadFile, type UploadResult } from '@/components/admin/uploader'
import { formatFileSize } from '@/lib/format'
import { Label } from '@/components/ui/input'

/**
 * Uploads the paid deliverable and reports the Storage path back to the form.
 *
 * The path is held in a hidden input rather than posted as a file, so saving the
 * product is a small JSON write no matter how large the upload was.
 */
export function ProductFileField({
  name,
  defaultPath,
  defaultType,
  defaultSizeMb,
}: {
  name: string
  defaultPath?: string | null
  defaultType?: string | null
  defaultSizeMb?: number | null
}) {
  const [path, setPath] = useState(defaultPath ?? '')
  const [type, setType] = useState(defaultType ?? '')
  const [sizeMb, setSizeMb] = useState<number | null>(defaultSizeMb ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function onPick(file: File) {
    setBusy(true)
    setError(null)
    const result = await uploadFile('file', file)
    setBusy(false)

    if ('error' in result) {
      setError(result.error)
      return
    }
    applyResult(result)
  }

  function applyResult(result: UploadResult) {
    setPath(result.path)
    setSizeMb(result.sizeMb)
    if (result.extension) setType(result.extension)
  }

  return (
    <div>
      <Label>Product file (what the buyer downloads)</Label>

      <input type="hidden" name={name} value={path} />
      <input type="hidden" name="file_type" value={type} />
      <input type="hidden" name="file_size_mb" value={sizeMb ?? ''} />

      <div className="mt-1.5 rounded-lg border border-dashed border-input bg-white p-4">
        {path ? (
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
                {path.split('/').pop()}
              </p>
              <p className="mt-0.5 text-xs text-brand-body/70">
                {type ? type.toUpperCase() : 'File'}
                {formatFileSize(sizeMb) && ` · ${formatFileSize(sizeMb)}`} · stored privately
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPath('')
                setSizeMb(null)
                setType('')
              }}
              className="shrink-0 rounded p-1 text-brand-body/60 hover:text-red-600"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 py-3 text-center"
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-cta" aria-hidden />
            ) : (
              <FileUp className="h-6 w-6 text-brand-body/50" aria-hidden />
            )}
            <span className="font-heading text-sm font-bold uppercase tracking-wide text-brand-heading">
              {busy ? 'Uploading…' : 'Upload the file'}
            </span>
            <span className="text-xs text-brand-body/70">
              PDF, ZIP, EPUB, XLSX — up to 500 MB
            </span>
          </button>
        )}

        <input
          ref={input}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onPick(file)
            // Reset so re-picking the same filename fires onChange again.
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/**
 * One or more marketing images. The first is the cover; the rest form the
 * gallery. Both are public URLs, so they go straight into the markup.
 */
export function ImageField({
  label,
  hint,
  multiple = false,
  coverName,
  galleryName,
  defaultCover,
  defaultGallery = [],
}: {
  label: string
  hint?: string
  multiple?: boolean
  coverName?: string
  galleryName?: string
  defaultCover?: string | null
  defaultGallery?: string[]
}) {
  const [cover, setCover] = useState(defaultCover ?? '')
  const [gallery, setGallery] = useState<string[]>(defaultGallery)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function onPick(files: FileList) {
    setBusy(true)
    setError(null)

    for (const file of Array.from(files).slice(0, 8)) {
      const result = await uploadFile('image', file)
      if ('error' in result) {
        setError(result.error)
        break
      }
      const url = result.publicUrl!
      if (!cover) setCover(url)
      else if (multiple) setGallery((g) => (g.includes(url) ? g : [...g, url]))
      else setCover(url)
    }

    setBusy(false)
  }

  return (
    <div>
      <Label>{label}</Label>
      {coverName && <input type="hidden" name={coverName} value={cover} />}
      {galleryName && (
        <input
          type="hidden"
          name={galleryName}
          // The cover leads the gallery so the product page's first frame and the
          // card's thumbnail are the same image.
          value={JSON.stringify([cover, ...gallery].filter(Boolean))}
        />
      )}

      <div className="mt-1.5 flex flex-wrap gap-3">
        {[cover, ...gallery].filter(Boolean).map((url, i) => (
          <div
            key={url}
            className="relative h-24 w-20 overflow-hidden rounded-md border border-border bg-brand-cream"
          >
            <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            {i === 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-brand-heading/80 py-0.5 text-center font-heading text-[9px] font-bold uppercase tracking-wider text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (i === 0) {
                  // Promote the next image so removing the cover does not leave
                  // the product with a gallery but no thumbnail.
                  const [next, ...rest] = gallery
                  setCover(next ?? '')
                  setGallery(rest)
                } else {
                  setGallery((g) => g.filter((u) => u !== url))
                }
              }}
              className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-brand-body hover:text-red-600"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-white text-brand-body/60 hover:border-brand-cta hover:text-brand-cta"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <ImageUp className="h-5 w-5" aria-hidden />
          )}
          <span className="font-heading text-[10px] font-bold uppercase tracking-wide">
            {busy ? 'Wait' : 'Add'}
          </span>
        </button>
      </div>

      {hint && <p className="mt-1.5 text-xs text-brand-body/70">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void onPick(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Single image, for a story block or a step card. */
export function InlineImageField({
  value,
  onChange,
}: {
  value?: string
  onChange: (url: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <div className="relative h-14 w-20 overflow-hidden rounded border border-border bg-brand-cream">
          <Image src={value} alt="" fill sizes="80px" className="object-cover" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-heading hover:border-brand-cta hover:text-brand-cta"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <ImageUp className="h-3 w-3" aria-hidden />
        )}
        {value ? 'Replace' : 'Add image'}
      </button>

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="font-heading text-[11px] font-bold uppercase tracking-wide text-brand-body/60 hover:text-red-600"
        >
          Remove
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          const result = await uploadFile('image', file)
          setBusy(false)
          if (!('error' in result) && result.publicUrl) onChange(result.publicUrl)
        }}
      />
    </div>
  )
}
