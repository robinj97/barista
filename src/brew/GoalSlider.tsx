interface GoalSliderProps {
  balance: number
  onChange: (balance: number) => void
}

/** "Balanced", "40% sweeter" or "60% more acidity": what the slider is set to. */
export function balanceLabel(balance: number): string {
  if (balance === 0) return 'Balanced'
  return `${Math.round(Math.abs(balance) * 100)}% ${balance < 0 ? 'sweeter' : 'more acidity'}`
}

/** Sweeter ↔ more acidity. Drag the handle; the readout says what it is set to. */
export function GoalSlider({ balance, onChange }: GoalSliderProps) {
  return (
    <div className="squircle rounded-4xl bg-soft px-6 py-5">
      <p className="num text-center text-lg" aria-live="polite">
        {balanceLabel(balance)}
      </p>
      <input
        type="range"
        aria-label="Sweeter or more acidity"
        aria-valuetext={balanceLabel(balance)}
        min={-1}
        max={1}
        step={0.1}
        value={balance}
        onChange={(event) => onChange(Math.round(Number(event.target.value) * 10) / 10)}
        className="mt-4 block h-6 w-full accent-[var(--accent)]"
      />
      <div className="mt-3 flex justify-between text-xs text-muted" aria-hidden>
        <span>Sweeter</span>
        <span>More acidity</span>
      </div>
    </div>
  )
}
