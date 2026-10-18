import { useState, type ReactNode } from 'react'
import { Sheet } from '../components/Sheet'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'

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
  /** Extra rule on the typed value; a message blocks Done. */
  check?: (value: number) => string | null
  /** Shown when this value was set by hand; puts it back to the suggestion. */
  onReset?: () => void
  children?: ReactNode
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places

function Editor({ title, value, unit, step, min, max, places = 0, onSave, onReset, check, children, close }: Omit<EditSheetProps, 'open' | 'onOpenChange'> & { close: () => void }) {
  const [text, setText] = useState(String(value))
  const parsed = Number(text)
  const inRange = text.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max
  const problem = inRange ? (check?.(parsed) ?? null) : null
  const valid = inRange && !problem
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
        <IconButton label={`Decrease ${title}`} size="xl" className="text-xl" onClick={() => nudge(-1)}>
          −
        </IconButton>
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
        <IconButton label={`Increase ${title}`} size="xl" className="text-xl" onClick={() => nudge(1)}>
          +
        </IconButton>
      </div>
      {!valid && (
        <p role="alert" className="text-center text-xs text-muted">
          {problem ?? `Use a number from ${min} to ${max}.`}
        </p>
      )}
      {children}
      <Button type="submit" disabled={!valid} className="mt-3">
        Done
      </Button>
      {onReset && (
        <Button
          onClick={() => {
            onReset()
            close()
          }}
          variant="quiet"
          size="md"
          className="mt-2"
        >
          Back to the suggestion
        </Button>
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
