import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)} {...props} />
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-lg bg-[#E2E8F0]/70', className)} {...props} />
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-[#E2E8F0]', className)} />
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn('flex size-4 items-center justify-center rounded border border-[#CBD5E1] bg-white data-[state=checked]:border-[#2563EB] data-[state=checked]:bg-[#2563EB]', className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3 text-white" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn('relative h-5 w-9 rounded-full bg-[#CBD5E1] transition data-[state=checked]:bg-[#2563EB]', className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  )
}

export const Tabs = TabsPrimitive.Root
export const TabsList = ({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn('inline-flex h-9 items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5', className)} {...props} />
)
export const TabsTrigger = ({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn('inline-flex h-8 items-center rounded-md px-3 text-sm text-[#64748B] data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=active]:font-medium', className)}
    {...props}
  />
)
