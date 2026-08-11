import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * The `cta` variant is the red button from the reference design and is the one
 * thing on the page allowed to use that colour. Everything else is neutral or
 * outlined, which is what makes a single red rectangle read as "the next step"
 * without needing an arrow or an animation to earn attention.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-heading font-bold uppercase tracking-wide transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        cta: 'bg-brand-cta text-white shadow-cta hover:bg-brand-accent active:translate-y-px',
        dark: 'bg-brand-heading text-white hover:bg-brand-body',
        outline: 'border-2 border-brand-heading bg-transparent text-brand-heading hover:bg-brand-heading hover:text-white',
        soft: 'bg-brand-tan text-brand-heading hover:bg-brand-cream',
        ghost: 'text-brand-heading hover:bg-brand-cream',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-5 text-sm',
        lg: 'h-14 px-8 text-base',
        xl: 'h-16 px-10 text-lg',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'cta', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
