import { useEffect, useRef, useState } from 'react'
import type { Pour } from '../../engine/types.ts'
import { clock } from './buildInput'
import { beep } from './cues'
import { currentPour, elapsedS, type BrewSession } from './session'

interface BrewingPanelProps {
  pours: Pour[]
  session: BrewSession
  now: number
  onTick: () => void
  onFinish: () => void
  onCancel: () => void
}

/** The running brew: the timer, what to pour next, and one big button to tick it off. */
export function BrewingPanel({ pours, session, now, onTick, onFinish, onCancel }: BrewingPanelProps) {
  const [confirming, setConfirming] = useState(false)
  const elapsed = elapsedS(session, now)
  const current = currentPour(session, pours.length)
  const next = current === null ? null : pours[current]!
  const due = next !== null && (current === 0 || elapsed >= next.atS)

  // One sound when the next pour comes due.
  const cued = useRef(-1)
  useEffect(() => {
    if (current !== null && current > 0 && elapsed >= pours[current]!.atS && cued.current < current) {
      cued.current = current
      beep()
    }
  }, [current, elapsed, pours])

  return (
    <section aria-label="Brewing" className="mt-4">
      <p role="timer" className="num text-center text-5xl font-medium">
        {clock(elapsed)}
      </p>
      <p className={`mt-2 text-center text-sm ${due ? 'text-accent' : 'text-muted'}`} aria-live="polite">
        {next === null
          ? 'All poured. Let it drain, then tap when the bed is dry.'
          : due
            ? `Pour ${current! + 1}: up to ${next.toG} g`
            : `Next: pour ${current! + 1} at ${clock(next.atS)}, up to ${next.toG} g`}
      </p>

      <button
        type="button"
        onClick={next === null ? onFinish : onTick}
        className="mt-4 h-16 w-full rounded-full bg-ink text-lg font-medium text-bg transition-transform active:scale-[0.98]"
      >
        {next === null ? 'Drawdown finished' : `Pour ${current! + 1} done`}
      </button>

      <ol className="mt-4 space-y-1" aria-label="Pour progress">
        {pours.map((pour, index) => {
          const done = index < session.ticksS.length
          return (
            <li
              key={pour.atS}
              aria-current={index === current ? 'step' : undefined}
              className={`flex items-center gap-3 rounded-full py-2 pr-5 pl-2 ${index === current ? 'bg-accent-soft' : ''}`}
            >
              <span className={`grid size-8 place-items-center rounded-full text-xs ${done ? 'bg-ink text-bg' : 'bg-soft'}`}>{done ? '✓' : index + 1}</span>
              <span className="num flex-1 text-sm">{clock(pour.atS)}</span>
              <span className="num text-sm text-muted">{done ? `done ${clock(session.ticksS[index]!)}` : ''}</span>
              <span className="num w-16 text-right text-sm">{pour.toG} g</span>
            </li>
          )
        })}
      </ol>

      {confirming ? (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-full bg-soft text-sm">
            Yes, cancel this brew
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-11 flex-1 rounded-full text-sm text-muted">
            Keep brewing
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="mt-4 h-11 w-full rounded-full text-sm text-muted">
          Cancel brew
        </button>
      )}
    </section>
  )
}
