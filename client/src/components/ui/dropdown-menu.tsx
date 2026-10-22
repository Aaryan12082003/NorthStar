import * as Dropdown from '@radix-ui/react-dropdown-menu'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = Dropdown.Root
export const DropdownMenuTrigger = Dropdown.Trigger

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        sideOffset={6}
        className={cn('z-50 min-w-44 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,0.08)]', className)}
        {...props}
      />
    </Dropdown.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#0F172A] outline-none data-[highlighted]:bg-[#F8FAFC]', className)}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Dropdown.Label>) {
  return <Dropdown.Label className={cn('px-2.5 py-1.5 text-xs font-medium text-[#64748B]', className)} {...props} />
}

export function DropdownMenuSeparator() {
  return <Dropdown.Separator className="my-1 h-px bg-[#E2E8F0]" />
}
