import { useState, type ReactNode } from 'react'
import { Sheet } from '../components/Sheet'

interface EditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  value: number
  unit: string
  step: number
  min: number
  max: number
  /** Decimal places kept. */
  places?: number
  onSave: (value: number) => void
  /** Shown when this value was set by hand; puts it back to the suggestion. */
  onReset?: () => void
  children?: ReactNode
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places

function Editor({ title, value, unit, step, min, max, places = 0, onSave, onReset, children, close }: Omit<EditSheetProps, 'open' | 'onOpenChange'> & { close: () => void }) {
  const [text, setText] = useState(String(value))
  const parsed = Number(text)
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max
  const nudge = (direction: 1 | -1) => setText(String(round(Math.min(max, Math.max(min, (valid ? parsed : value) + direction * step)), places)))

  return (
    <form
      className="px-3 pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        onSave(round(parsed, places))
        close()
      }}
    >
      <div className="flex items-center justify-center gap-4 py-4">
        <button type="button" aria-label={`Decrease ${title}`} onClick={() => nudge(-1)} className="size-12 rounded-full bg-soft text-xl active:scale-95">
          −
        </button>
        <label className="flex items-baseline gap-1">
          <span className="sr-only">{title}</span>
          <input
            type="number"
            inputMode="decimal"
            step={step}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={!valid}
            className="num w-24 rounded-2xl bg-soft py-2 text-center text-3xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <span className="text-sm text-muted">{unit}</span>
        </label>
        <button type="button" aria-label={`Increase ${title}`} onClick={() => nudge(1)} className="size-12 rounded-full bg-soft text-xl active:scale-95">
          +
        </button>
      </div>
      {!valid && (
        <p role="alert" className="text-center text-xs text-muted">
          Use a number from {min} to {max}.
        </p>
      )}
      {children}
      <button type="submit" disabled={!valid} className="mt-3 h-12 w-full rounded-full bg-ink font-medium text-bg disabled:opacity-40">
        Done
      </button>
      {onReset && (
        <button
          type="button"
          onClick={() => {
            onReset()
            close()
          }}
          className="mt-2 h-11 w-full rounded-full text-sm text-muted"
        >
          Back to the suggestion
        </button>
      )}
    </form>
  )
}

/** Edit one number: steppers or type it. Applies on Done. */
export function EditSheet({ open, onOpenChange, ...rest }: EditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={rest.title}>
      {open && <Editor {...rest} close={() => onOpenChange(false)} />}
    </Sheet>
  )
}
