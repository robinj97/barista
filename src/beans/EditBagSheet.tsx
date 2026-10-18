import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { useUpdateBag } from '../data/hooks'
import type { Bag } from '../data/types'
import { daysAgo, formatDMY, maskDMY, parseDMY } from './dates'
import { Button } from '../components/Button'

interface EditBagSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bag: Bag
}

const field = 'h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent'

function Form({ bag, close }: { bag: Bag; close: () => void }) {
  const update = useUpdateBag()
  const [roast, setRoast] = useState(bag.roastDate ? formatDMY(bag.roastDate) : '')
  const [left, setLeft] = useState(bag.gramsRemaining != null ? String(bag.gramsRemaining) : '')
  const [errors, setErrors] = useState<{ roast?: string; left?: string }>({})

  function save() {
    const next: typeof errors = {}
    let roastDate: string | null = null
    if (roast.trim()) {
      roastDate = parseDMY(roast)
      if (!roastDate) next.roast = 'Use the form dd/mm/yyyy'
      else if (roastDate > daysAgo(0)) next.roast = "That's in the future"
      else if (roastDate < daysAgo(730)) next.roast = 'That is more than two years ago'
    }
    let grams: number | null = null
    if (left.trim()) {
      grams = Number(left)
      if (!Number.isFinite(grams) || grams < 0 || grams > 5000) next.left = 'Enter grams, 0 to 5000'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    update.mutate({ bagId: bag.id, patch: { roastDate, gramsRemaining: grams } })
    close()
  }

  return (
    <form
      className="space-y-3 px-3 pb-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <label className="block">
        <span className="px-2 text-xs text-muted">Roasted</span>
        <input
          value={roast}
          onChange={(event) => setRoast(maskDMY(event.target.value))}
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-invalid={!!errors.roast}
          className={`${field} num mt-1`}
        />
        {errors.roast && (
          <span role="alert" className="mt-1 block px-2 text-xs text-accent">
            {errors.roast}
          </span>
        )}
      </label>
      <label className="block">
        <span className="px-2 text-xs text-muted">Left in the bag (g)</span>
        <input
          value={left}
          onChange={(event) => setLeft(event.target.value)}
          type="number"
          inputMode="decimal"
          placeholder="Not set"
          aria-invalid={!!errors.left}
          className={`${field} num mt-1`}
        />
        {errors.left && (
          <span role="alert" className="mt-1 block px-2 text-xs text-accent">
            {errors.left}
          </span>
        )}
      </label>
      <Button type="submit">
        Save
      </Button>
      <Button
        onClick={() => {
          update.mutate({ bagId: bag.id, patch: { finishedAt: bag.finishedAt ? null : new Date().toISOString() } })
          close()
        }}
        variant="soft"
      >
        {bag.finishedAt ? 'Back in use' : 'Mark as finished'}
      </Button>
      {!bag.finishedAt && <p className="px-2 text-center text-xs text-muted">A finished bag moves out of the way. Its brews and recipes stay.</p>}
    </form>
  )
}

/** Fix the roast date and how much is left, or mark the bag finished (and bring it back). */
export function EditBagSheet({ open, onOpenChange, bag }: EditBagSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Edit this bag">
      {open && <Form bag={bag} close={() => onOpenChange(false)} />}
    </Sheet>
  )
}
