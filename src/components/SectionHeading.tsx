import type { ReactNode } from 'react'

/** The small grey title above a group of cards. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-2 text-xs font-medium text-muted">{children}</h2>
}
