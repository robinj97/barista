interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/** An on/off toggle. Names itself for screen readers with `label`. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-hairline'}`}
    >
      <span className={`absolute top-1 left-1 size-6 rounded-full bg-bg transition-transform duration-200 ${checked ? 'translate-x-6' : ''}`} />
    </button>
  )
}
