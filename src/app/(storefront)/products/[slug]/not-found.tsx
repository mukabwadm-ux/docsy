import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ProductNotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-14 text-center">
      <h1 className="text-2xl">This product is not available</h1>
      <p className="mt-2 max-w-md text-brand-body">
        It may have been unpublished, or the link may be out of date.
      </p>
      <Button asChild variant="cta" size="md" className="mt-6">
        <Link href="/products">See what else is here</Link>
      </Button>
    </div>
  )
}
