interface MultiChipGroupProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T[]
  onChange: (value: T[]) => void
}

/** A row of pill choices where any number can be selected. */
export function MultiChipGroup<T extends string>({ label, options, value, onChange }: MultiChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((v) => v !== option.value) : [...value, option.value])}
            className={`h-10 rounded-full px-4 text-sm transition-colors duration-200 ${selected ? 'bg-ink text-bg' : 'bg-soft text-ink'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
