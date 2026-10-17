interface ChipGroupProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
  /** Tapping the selected chip again clears it. Default true. */
  clearable?: boolean
}

/** A row of pill choices; one at most is selected. */
export function ChipGroup<T extends string>({ label, options, value, onChange, clearable = true }: ChipGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected && clearable ? null : option.value)}
            className={`h-10 rounded-full px-4 text-sm transition-colors duration-200 ${
              selected ? 'bg-ink text-bg' : 'bg-soft text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
