'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Loader2, Plus } from 'lucide-react'
import { createCategory, type ActionState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { slugify } from '@/lib/utils'

const initial: ActionState = { status: 'idle' }

/** Names the homepage grid knows how to render. */
const ICONS = ['book-open', 'layout-template', 'palette', 'pen-tool', 'file-text', 'sparkles']

export function CategoryForm() {
  const [state, formAction] = useFormState(createCategory, initial)
  const [name, setName] = useState('')
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success') {
      form.current?.reset()
      setName('')
    }
  }, [state.status])

  return (
    <form ref={form} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Templates"
            className="mt-1.5"
          />
          {state.fieldErrors?.name && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="cat-slug">Slug</Label>
          <Input
            id="cat-slug"
            name="slug"
            // Follows the name until submitted; the value is derived rather than
            // held in its own state so it can never drift out of sync.
            value={slugify(name)}
            readOnly
            className="mt-1.5 bg-brand-cream/40"
          />
        </div>

        <div>
          <Label htmlFor="cat-icon">Icon</Label>
          <Select id="cat-icon" name="icon" defaultValue="file-text" className="mt-1.5">
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="cat-sort">Sort order</Label>
          <Input
            id="cat-sort"
            name="sort_order"
            type="number"
            min="0"
            defaultValue="0"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="cat-desc">Description (optional)</Label>
        <Input
          id="cat-desc"
          name="description"
          maxLength={300}
          placeholder="Shown at the top of the category page."
          className="mt-1.5"
        />
      </div>

      {state.message && (
        <p
          className={state.status === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="dark" size="md" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      {pending ? 'Adding…' : 'Add category'}
    </Button>
  )
}
