'use client'

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import {
  AlertCircle,
  Check,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Plug,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  clearConfigValue,
  saveConfigGroup,
  testEmailConnection,
  testPaystackConnection,
  type ConfigState,
} from '@/actions/config'
import { Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import type { ConfigField, ConfigGroup } from '@/lib/config-registry'

const initial: ConfigState = { status: 'idle' }

export interface ResolvedField {
  value: string | null
  source: 'env' | 'database' | 'unset'
  masked?: string
}

/**
 * One form per settings group.
 *
 * Grouped rather than one big save so a validation failure in analytics cannot
 * roll back a payment key that saved cleanly, and so the confirmation can name
 * what actually changed.
 */
export function IntegrationForm({
  group,
  resolved,
  encryptionReady,
  encryptionHint,
}: {
  group: ConfigGroup
  resolved: Record<string, ResolvedField>
  encryptionReady: boolean
  encryptionHint: string
}) {
  const [state, formAction] = useFormState(saveConfigGroup, initial)
  const [test, setTest] = useState<ConfigState | null>(null)
  const [testing, startTest] = useTransition()

  const hasSecrets = group.fields.some((f) => f.secret)
  const canTest = group.id === 'payments' || group.id === 'email'

  function runTest() {
    setTest(null)
    startTest(async () => {
      const result =
        group.id === 'payments' ? await testPaystackConnection() : await testEmailConnection()
      setTest(result)
    })
  }

  return (
    <Card className="p-5">
      <form action={formAction}>
        <input type="hidden" name="group" value={group.id} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg">
              <Plug className="h-4 w-4 text-brand-cta" aria-hidden />
              {group.label}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-brand-body">{group.description}</p>
          </div>

          {canTest && (
            <Button type="button" variant="outline" size="sm" onClick={runTest} disabled={testing}>
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="h-3.5 w-3.5" aria-hidden />
              )}
              Test connection
            </Button>
          )}
        </div>

        {hasSecrets && !encryptionReady && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>Secrets cannot be saved yet.</strong> {encryptionHint} Storing a payment key
              unencrypted is not offered — it would be worse than keeping it in the environment.
            </span>
          </p>
        )}

        {test && (
          <p
            className={
              test.status === 'success'
                ? 'mt-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800'
                : 'mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'
            }
            role="status"
          >
            {test.status === 'success' ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            {test.message}
          </p>
        )}

        <div className="mt-5 space-y-4">
          {group.fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              resolved={resolved[field.key] ?? { value: null, source: 'unset' }}
              error={state.fieldErrors?.[field.key]}
              encryptionReady={encryptionReady}
            />
          ))}
        </div>

        {state.status === 'error' && state.message && (
          <p
            className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {state.message}
          </p>
        )}
        {state.status === 'success' && state.message && (
          <p className="mt-4 flex items-center gap-2 text-sm text-green-700" role="status">
            <Check className="h-4 w-4" aria-hidden />
            {state.message}
          </p>
        )}

        <div className="mt-5">
          <SubmitButton label={group.label} />
        </div>
      </form>
    </Card>
  )
}

function FieldRow({
  field,
  resolved,
  error,
  encryptionReady,
}: {
  field: ConfigField
  resolved: ResolvedField
  error?: string
  encryptionReady: boolean
}) {
  const [clearing, startClear] = useTransition()
  const [cleared, setCleared] = useState(false)

  const fromEnv = resolved.source === 'env'
  const stored = resolved.source === 'database'
  const locked = fromEnv || (field.secret === true && !encryptionReady)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={field.key}>{field.label}</Label>

        {fromEnv && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-brand-cream px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body"
            title={`Set by the ${field.env} environment variable, which takes precedence over this form.`}
          >
            <Lock className="h-3 w-3" aria-hidden />
            From environment
          </span>
        )}
        {stored && field.secret && !cleared && (
          <button
            type="button"
            onClick={() =>
              startClear(async () => {
                await clearConfigValue(field.key)
                setCleared(true)
              })
            }
            className="inline-flex items-center gap-1 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-body/60 hover:text-red-600"
          >
            {clearing ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3 w-3" aria-hidden />
            )}
            Remove
          </button>
        )}
      </div>

      {field.secret ? (
        <>
          {/* A stored secret is shown masked and never sent to the browser in
              full — this page could be screen-shared or cached. */}
          {stored && !cleared && (
            <p className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-brand-cream/40 px-3 py-2 font-mono text-xs text-brand-body">
              <Eye className="h-3.5 w-3.5 shrink-0 text-brand-body/50" aria-hidden />
              {resolved.masked}
            </p>
          )}
          <Input
            id={field.key}
            name={field.key}
            type="password"
            autoComplete="off"
            disabled={locked}
            placeholder={
              locked
                ? 'Managed in the environment'
                : stored && !cleared
                  ? 'Enter a new value to replace it'
                  : (field.placeholder ?? '')
            }
            className="mt-1.5"
          />
        </>
      ) : (
        <Input
          id={field.key}
          name={field.key}
          type={field.type === 'number' ? 'number' : 'text'}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          defaultValue={resolved.value ?? ''}
          disabled={locked}
          placeholder={locked ? 'Managed in the environment' : (field.placeholder ?? '')}
          className="mt-1.5"
        />
      )}

      {field.hint && <p className="mt-1 text-xs text-brand-body/70">{field.hint}</p>}
      {field.env && !fromEnv && (
        <p className="mt-1 text-xs text-brand-body/50">
          Can also be set as {field.env} in the environment, which would take precedence.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="cta" size="md" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : `Save ${label.toLowerCase()}`}
    </Button>
  )
}
