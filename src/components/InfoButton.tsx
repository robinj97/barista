import { useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { IconButton } from './IconButton'

interface InfoButtonProps {
  /** What the button is for, for screen readers: "About strength". */
  label: string
  title: string
  children: ReactNode
}

/** A small (i) that opens a short explanation in a sheet. */
export function InfoButton({ label, title, children }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={label} tone="plain" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
        </svg>
      </IconButton>
      <Sheet open={open} onOpenChange={setOpen} title={title}>
        <div className="px-3 pb-3">{children}</div>
      </Sheet>
    </>
  )
}
