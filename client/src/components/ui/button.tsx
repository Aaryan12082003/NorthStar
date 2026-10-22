import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#2563EB] text-white shadow-sm hover:bg-[#1D4ED8]',
        outline: 'border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]',
        ghost: 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]',
        destructive: 'bg-[#EF4444] text-white hover:bg-[#DC2626]',
        soft: 'bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-2.5 text-[13px]',
        lg: 'h-10 px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
