import { useState } from 'react'
import { MAX_POURS, LIMITS, validateOverrides } from '../../engine/overrides.ts'
import type { Pour } from '../../engine/types.ts'
import { Sheet } from '../components/Sheet'
import { clock } from './buildInput'
import { Button } from '../components/Button'

interface PoursSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pours: Pour[]
  edited: boolean
  onSave: (pours: Pour[]) => void
  onReset: () => void
}

interface Row {
  at: string
  to: string
}

/** "1:15" or "75" to seconds. */
function parseClock(text: string): number {
  const [m, s] = text.includes(':') ? text.split(':') : ['0', text]
  return Number(m) * 60 + Number(s)
}

const toRows = (pours: Pour[]): Row[] => pours.map((p) => ({ at: clock(p.atS), to: String(p.toG) }))

const field = 'num h-11 w-full rounded-2xl bg-soft text-center outline-none focus-visible:ring-2 focus-visible:ring-accent'

function Editor({ pours, edited, onSave, onReset, close }: Omit<PoursSheetProps, 'open' | 'onOpenChange'> & { close: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(pours))
  const next: Pour[] = rows.map((r, i) => ({ atS: i === 0 ? 0 : parseClock(r.at), toG: Number(r.to) }))
  let error: string | null = null
  try {
    validateOverrides({ pours: next })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Check the pours'
  }
  const patch = (index: number, change: Partial<Row>) => setRows((all) => all.map((r, i) => (i === index ? { ...r, ...change } : r)))
  const add = () =>
    setRows((all) => {
      const last = next.at(-1)!
      return [...all, { at: clock(last.atS + 30), to: String(last.toG + 50) }]
    })

  return (
    <form
      className="px-3 pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (error) return
        onSave(next)
        close()
      }}
    >
      <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 px-1 pb-1 text-xs text-muted">
        <span />
        <span className="text-center">Start (m:ss)</span>
        <span className="text-center">Total water (g)</span>
        <span />
      </div>
      <ol className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-soft text-xs">{i + 1}</span>
            <input aria-label={`Pour ${i + 1} start`} value={i === 0 ? '0:00' : row.at} disabled={i === 0} onChange={(e) => patch(i, { at: e.target.value })} className={`${field} disabled:text-muted`} />
            <input aria-label={`Pour ${i + 1} total water`} type="number" inputMode="decimal" value={row.to} onChange={(e) => patch(i, { to: e.target.value })} className={field} />
            <button
              type="button"
              aria-label={`Remove pour ${i + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
              className="size-10 rounded-full text-muted disabled:opacity-30"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={add} disabled={rows.length >= MAX_POURS} className="mt-3 h-11 w-full rounded-full bg-soft text-sm disabled:opacity-40">
        Add a pour
      </button>
      <p className="mt-2 px-2 text-xs text-muted">
        The last pour is your total water ({LIMITS.waterG[0]}–{LIMITS.waterG[1]} g).
      </p>
      {error && (
        <p role="alert" className="mt-2 px-2 text-xs text-accent">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!!error} className="mt-3">
        Done
      </Button>
      {edited && (
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

/** Edit every pour: when it starts and how much water the scale shows after it. */
export function PoursSheet({ open, onOpenChange, ...rest }: PoursSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Pours">
      {open && <Editor {...rest} close={() => onOpenChange(false)} />}
    </Sheet>
  )
}
