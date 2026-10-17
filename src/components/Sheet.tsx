import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

/** A rounded bottom sheet for choices and short forms. */
export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-h-[85dvh] max-w-xl flex-col rounded-[2rem] bg-bg pb-[max(0.75rem,env(safe-area-inset-bottom))] outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-hairline" />
          <Drawer.Title className="px-6 pt-4 pb-2 text-lg font-medium">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{title}</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
