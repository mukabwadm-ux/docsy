import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-heading text-6xl font-bold text-brand-cta">404</p>
      <h1 className="mt-4 text-2xl">We could not find that page</h1>
      <p className="mt-2 max-w-md text-brand-body">
        The link may be out of date, or the product may have been unpublished.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="cta" size="md">
          <Link href="/products">Browse all products</Link>
        </Button>
        <Button asChild variant="outline" size="md">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  )
}
