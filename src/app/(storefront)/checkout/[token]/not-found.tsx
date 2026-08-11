import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function CheckoutNotFound() {
  return (
    <div className="container flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-14 text-center">
      <h1 className="text-2xl">We could not find that order</h1>
      <p className="mt-3 text-brand-body">
        The link may be mistyped, or the checkout may have been cleared. Nothing was charged.
      </p>
      <Button asChild variant="cta" size="lg" className="mt-6">
        <Link href="/products">Browse the shop</Link>
      </Button>
    </div>
  )
}
