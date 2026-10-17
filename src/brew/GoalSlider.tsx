import { GOAL_BALANCE, GOAL_LABELS, type Goal } from './params'

const STOPS = (Object.keys(GOAL_LABELS) as Goal[]).map((goal) => ({ goal, label: GOAL_LABELS[goal], balance: GOAL_BALANCE[goal] }))

interface GoalSliderProps {
  balance: number
  onChange: (balance: number) => void
  /** Water in the first two pours, which is all the goal moves. */
  pours: { first: number; second: number }
}

/** Sweeter ↔ more acidity on one slider. Tap a label or drag; the two pours it changes update live. */
export function GoalSlider({ balance, onChange, pours }: GoalSliderProps) {
  return (
    <div className="squircle rounded-4xl bg-soft px-5 pt-4 pb-3">
      <input
        type="range"
        aria-label="Sweeter or more acidity"
        min={-1}
        max={1}
        step={0.1}
        value={balance}
        onChange={(event) => onChange(Math.round(Number(event.target.value) * 10) / 10)}
        className="block w-full accent-[var(--accent)]"
      />
      <div className="relative mt-1 h-8">
        {STOPS.map((stop) => (
          <button
            key={stop.goal}
            type="button"
            aria-pressed={balance === stop.balance}
            onClick={() => onChange(stop.balance)}
            style={{ left: `${((stop.balance + 1) / 2) * 100}%` }}
            className={`absolute h-8 -translate-x-1/2 rounded-full px-3 text-sm whitespace-nowrap ${
              balance === stop.balance ? 'bg-ink text-bg' : 'text-muted'
            }`}
          >
            {stop.label}
          </button>
        ))}
      </div>
      <p className="num mt-2 text-center text-xs text-muted" aria-live="polite">
        First pour {pours.first} g · second pour {pours.second} g
      </p>
    </div>
  )
}
