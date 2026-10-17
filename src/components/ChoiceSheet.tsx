import { useState } from 'react'
import { Sheet } from './Sheet'

interface ChoiceSheetProps<T extends string> {
  title: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** Colour of the trigger: 'soft' on the page, 'bg' when it sits inside a soft card. */
  tone?: 'soft' | 'bg'
}

/** Choices live in bottom sheets, not new pages. */
export function ChoiceSheet<T extends string>({ title, options, value, onChange, tone = 'soft' }: ChoiceSheetProps<T>) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex h-14 w-full items-center justify-between rounded-full px-6 text-left transition-transform active:scale-[0.98] ${tone === 'bg' ? 'bg-bg' : 'bg-soft'}`}
      >
        <span className="text-muted">{title}</span>
        <span className="font-medium">{selected?.label ?? value}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={title}>
        <ul className="space-y-1">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex h-12 w-full items-center justify-between rounded-full px-5 text-left transition-colors ${
                  option.value === value ? 'bg-accent-soft' : 'active:bg-soft'
                }`}
              >
                <span>{option.label}</span>
                {option.value === value && <span className="text-sm text-accent">Selected</span>}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
