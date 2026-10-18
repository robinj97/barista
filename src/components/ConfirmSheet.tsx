import type { ReactNode } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'

interface ConfirmSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** What will happen, in a sentence or two. */
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
}

/** "Are you sure?" for something you cannot take back with one tap: a sentence, the action, and a way out. */
export function ConfirmSheet({ open, onOpenChange, title, children, confirmLabel, cancelLabel = 'Keep it', onConfirm }: ConfirmSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="px-3 pb-3">
        <p className="px-1 text-sm text-muted">{children}</p>
        <Button className="mt-4" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="quiet" size="md" className="mt-2" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  )
}
