import { useEffect, useRef, useState } from 'react'
import type { Pour } from '../../engine/types.ts'
import { clock } from './buildInput'
import { PourList } from './PourList'
import { beep } from './cues'
import { currentIndex, phaseAt } from './progress'
import { elapsedS, type BrewSession } from './session'
import { Button } from '../components/Button'

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
      {/* Not shown: the ring, list and timer say it. Kept for screen readers. */}
      <p className="sr-only" aria-live="polite">
        {phase.kind === 'pouring' && `Pour ${phase.index + 1}: up to ${pours[phase.index]!.toG} g`}
        {phase.kind === 'waiting' && `Pour ${phase.index + 2} in ${clock(phase.nextAtS - elapsed)}, up to ${pours[phase.index + 1]!.toG} g`}
        {phase.kind === 'drawdown' && 'Drawdown: let it drain, tap below when the bed is dry.'}
      </p>

      {phase.kind === 'drawdown' && (
        <button type="button" onClick={onFinish} className="mt-4 h-16 w-full rounded-full bg-ink text-lg font-medium text-bg transition-transform active:scale-[0.98]">
          Drawdown finished
        </button>
      )}

      <PourList
        pours={pours}
        label="Pour progress"
        className="mt-4"
        progress={(index) => {
          // A pour stays highlighted until the next one begins, and is ticked then.
          if (index < current || (phase.kind === 'drawdown' && index === current)) return 'done'
          return phase.kind !== 'drawdown' && index === current ? 'active' : 'upcoming'
        }}
      />

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
        <Button onClick={() => setConfirming(true)} variant="quiet" size="md" className="mt-4">
          Cancel brew
        </Button>
      )}
    </section>
  )
}
