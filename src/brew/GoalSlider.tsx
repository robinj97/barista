import { GOAL_BALANCE, GOAL_LABELS, type Goal } from './params'

const PRESETS = (Object.keys(GOAL_LABELS) as Goal[]).map((goal) => ({ goal, label: GOAL_LABELS[goal], balance: GOAL_BALANCE[goal] }))

interface GoalSliderProps {
  balance: number
  onChange: (balance: number) => void
}

function balanceLabel(balance: number): string {
  if (balance === 0) return 'Balanced'
  return `${Math.round(Math.abs(balance) * 100)}% ${balance < 0 ? 'sweeter' : 'more acidity'}`
}

/** Presets on top for a quick pick, the slider below for exact control, and a quiet readout of the value. */
export function GoalSlider({ balance, onChange }: GoalSliderProps) {
  return (
    <div className="squircle rounded-4xl bg-soft p-3 pb-4">
      <div role="radiogroup" aria-label="Goal" className="flex rounded-full bg-bg p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.goal}
            type="button"
            role="radio"
            aria-checked={balance === preset.balance}
            onClick={() => onChange(preset.balance)}
            className={`h-10 flex-1 rounded-full px-2 text-sm transition-colors duration-200 ${
              balance === preset.balance ? 'bg-ink text-bg' : 'text-muted'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="px-3">
        <input
          type="range"
          aria-label="Sweeter or more acidity"
          aria-valuetext={balanceLabel(balance)}
          min={-1}
          max={1}
          step={0.1}
          value={balance}
          onChange={(event) => onChange(Math.round(Number(event.target.value) * 10) / 10)}
          className="mt-6 block h-6 w-full accent-[var(--accent)]"
        />
        <p className="num mt-2 text-center text-xs text-muted/70" aria-live="polite">
          {balanceLabel(balance)}
        </p>
      </div>
    </div>
  )
}
