import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** URL-safe slug from a title. Used by the admin form's slug suggestion. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Normalises an embedded PostgREST relation to a single row.
 *
 * A to-one embed (`products ( … )` across a foreign key) returns an object at
 * runtime, but supabase-js cannot tell one-to-one from one-to-many by reading
 * the select string, so it types every embed as an array. Accepting both shapes
 * beats asserting one and risking `undefined` at the call site.
 */
export function one<T>(value: T | T[] | null | undefined): T | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}
