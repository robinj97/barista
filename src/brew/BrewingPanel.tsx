import { useEffect, useRef, useState } from 'react'
import type { Pour } from '../../engine/types.ts'
import { clock } from './buildInput'
import { beep } from './cues'
import { currentIndex, phaseAt } from './progress'
import { elapsedS, type BrewSession } from './session'

interface BrewingPanelProps {
  pours: Pour[]
  session: BrewSession
  now: number
  onFinish: () => void
  onCancel: () => void
}

/** The running brew. It follows the schedule by itself; the only tap is when the drawdown is over. */
export function BrewingPanel({ pours, session, now, onFinish, onCancel }: BrewingPanelProps) {
  const [confirming, setConfirming] = useState(false)
  const elapsed = elapsedS(session, now)
  const phase = phaseAt(pours, elapsed)
  const current = currentIndex(phase, pours)

  // One sound as each pour begins (not for the first: you just tapped start).
  const cued = useRef(0)
  useEffect(() => {
    if (current > cued.current) {
      cued.current = current
      beep()
    }
  }, [current])

  return (
    <section aria-label="Brewing" className="mt-4">
      <p role="timer" className="num text-center text-5xl font-medium">
        {clock(elapsed)}
      </p>
      <p className={`mt-2 text-center text-sm ${phase.kind === 'pouring' ? 'text-accent' : 'text-muted'}`} aria-live="polite">
        {phase.kind === 'pouring' && `Pour ${phase.index + 1}: up to ${pours[phase.index]!.toG} g`}
        {phase.kind === 'waiting' && `Pour ${phase.index + 2} in ${clock(phase.nextAtS - elapsed)}, up to ${pours[phase.index + 1]!.toG} g`}
        {phase.kind === 'drawdown' && 'Drawdown: let it drain, tap below when the bed is dry.'}
      </p>

      {phase.kind === 'drawdown' && (
        <button type="button" onClick={onFinish} className="mt-4 h-16 w-full rounded-full bg-ink text-lg font-medium text-bg transition-transform active:scale-[0.98]">
          Drawdown finished
        </button>
      )}

      <ol className="mt-4 space-y-1" aria-label="Pour progress">
        {pours.map((pour, index) => {
          // A pour stays highlighted until the next one begins, and is ticked then.
          const done = index < current || (phase.kind === 'drawdown' && index === current)
          const active = phase.kind !== 'drawdown' && index === current
          return (
            <li key={pour.atS} aria-current={active ? 'step' : undefined} className={`flex items-center gap-3 rounded-full py-2 pr-5 pl-2 ${active ? 'bg-accent-soft' : ''}`}>
              <span className={`grid size-8 place-items-center rounded-full text-xs ${done ? 'bg-ink text-bg' : 'bg-soft'}`}>{done ? '✓' : index + 1}</span>
              <span className="num flex-1 text-sm">{clock(pour.atS)}</span>
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
