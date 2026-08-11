import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-heading text-[11px] font-bold uppercase tracking-wider',
  {
    variants: {
      variant: {
        cta: 'bg-brand-cta text-white',
        tan: 'bg-brand-tan text-brand-heading',
        cream: 'bg-brand-cream text-brand-heading',
        dark: 'bg-brand-heading text-white',
        outline: 'border border-border text-brand-body',
        muted: 'bg-muted text-muted-foreground',
      },
      size: {
        sm: 'px-2 py-0.5',
        md: 'px-3 py-1',
      },
    },
    defaultVariants: { variant: 'tan', size: 'sm' },
  }
)

export function Badge({
  className,
  variant,
  size,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
}
