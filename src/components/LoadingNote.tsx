import type { ReactNode } from 'react'

/** What a screen shows while its data loads. */
export function LoadingNote({ children = 'Loading…' }: { children?: ReactNode }) {
  return (
    <p role="status" className="mt-10 text-center text-sm text-muted">
      {children}
    </p>
  )
}
