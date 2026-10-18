import type { Pour } from '../../engine/types.ts'
import { clock } from './buildInput'

export type PourState = 'done' | 'active' | 'upcoming'

interface PourListProps {
  pours: Pour[]
  label?: string
  className?: string
  /** Show how much each pour adds ("+60 g") before the running total. */
  amounts?: boolean
  /** Where each pour is in a brew in progress: done ones are ticked, the active one is highlighted. */
  progress?: (index: number) => PourState
}

/** The pours of a recipe: when each starts and the water on the scale after it. Used planned, running, and for a friend's recipe. */
export function PourList({ pours, label, className = '', amounts = false, progress }: PourListProps) {
  return (
    <ol className={`space-y-1 ${className}`.trim()} aria-label={label}>
      {pours.map((pour, index) => {
        const state = progress?.(index) ?? 'upcoming'
        return (
          <li
            key={pour.atS}
            aria-current={state === 'active' ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-full py-2 pr-5 pl-2 ${state === 'active' ? 'bg-accent-soft' : ''}`}
          >
            <span className={`grid size-8 place-items-center rounded-full text-xs ${state === 'done' ? 'bg-ink text-bg' : 'bg-soft'}`}>{state === 'done' ? '✓' : index + 1}</span>
            <span className="num flex-1 text-sm">{clock(pour.atS)}</span>
            {amounts && <span className="num text-sm text-muted">+{pour.toG - (pours[index - 1]?.toG ?? 0)} g</span>}
            <span className="num w-16 text-right text-sm">{pour.toG} g</span>
          </li>
        )
      })}
    </ol>
  )
}
