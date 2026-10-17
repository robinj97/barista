import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useVisibleViewport } from './useVisibleViewport'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Take the full height straight away, for search sheets whose results arrive as you type. */
  fill?: boolean
  children: ReactNode
}

/** Gap kept between the sheet and the screen edges, matching `inset-x-2 bottom-2`. */
const EDGE_GAP = 8
/** Room left above the sheet so it still reads as a sheet, not a page. */
const TOP_GAP = 16

/** A rounded bottom sheet for choices and short forms. */
export function Sheet({ open, onOpenChange, title, fill = false, children }: SheetProps) {
  // vaul's own keyboard handling freezes the sheet at the height it had when the keyboard
  // opened, which clips content that arrives later (search results). We place it ourselves.
  const visible = useVisibleViewport(open)
  const keyboardOpen = (visible?.bottomInset ?? 0) > 0
  const style = visible
    ? {
        bottom: visible.bottomInset + EDGE_GAP,
        [fill ? 'height' : 'maxHeight']: `min(85dvh, ${visible.height - EDGE_GAP - TOP_GAP}px)`,
      }
    : undefined

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          style={style}
          className={`fixed inset-x-2 bottom-2 z-50 mx-auto flex max-h-[85dvh] max-w-xl flex-col rounded-[2rem] bg-bg outline-none ${
            fill ? 'h-[85dvh]' : ''
          } ${keyboardOpen ? 'pb-3' : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'}`}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-hairline" />
          <Drawer.Title className="px-6 pt-4 pb-2 text-lg font-medium">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{title}</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
