'use client'

import { createUploadUrl } from '@/actions/admin'
import { createClient } from '@/lib/supabase/client'

export interface UploadResult {
  /** Storage path. For images this is also resolvable to a public URL. */
  path: string
  publicUrl?: string
  sizeMb: number
  extension: string
}

/**
 * Uploads a file straight from the browser to Supabase Storage.
 *
 * The server action only issues a signed, single-use URL scoped to one path —
 * the bytes never pass through the Next server. That is what allows a 300 MB
 * bundle to upload at all: a Server Action body is capped at 1 MB by default,
 * and raising the cap would route the whole file through our compute.
 */
export async function uploadFile(
  kind: 'image' | 'file',
  file: File
): Promise<UploadResult | { error: string }> {
  const ticket = await createUploadUrl(kind, file.name)
  if ('error' in ticket) return { error: ticket.error }

  const supabase = createClient()
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, {
      contentType: file.type || 'application/octet-stream',
    })

  if (error) return { error: error.message }

  const extension = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase()
    : ''

  const result: UploadResult = {
    path: ticket.path,
    sizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
    extension,
  }

  // Images are referenced by public URL in the markup; private files are
  // referenced by path and only ever resolved through a signed URL.
  if (kind === 'image') {
    const { data } = supabase.storage.from(ticket.bucket).getPublicUrl(ticket.path)
    result.publicUrl = data.publicUrl
  }

  return result
}
