import { useState } from 'react'
import { ChipGroup } from '../components/ChipGroup'
import { beanCover } from './cover'
import { daysAgo, formatDMY, maskDMY, parseDMY } from './dates'

export interface BagDetails {
  roastDate: string | null
  grams: number | null
}

interface BagStepProps {
  beanId: string
  name: string
  roaster: string
  /** Roast date and size read from a photo, for the person to confirm. */
  initial?: BagDetails
  onBack: () => void
  onSubmit: (details: BagDetails) => void
}

const ROAST_CHIPS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: '3', label: '3 days ago', days: 3 },
  { value: '7', label: '1 week ago', days: 7 },
  { value: '14', label: '2 weeks ago', days: 14 },
  { value: 'pick', label: 'Pick date' },
  { value: 'unsure', label: 'Not sure' },
] as const

const SIZE_CHIPS = [
  { value: '100', label: '100 g' },
  { value: '250', label: '250 g' },
  { value: '340', label: '340 g' },
  { value: '500', label: '500 g' },
  { value: '1000', label: '1 kg' },
  { value: 'other', label: 'Other' },
] as const

function initialSize(grams: number | null | undefined): { size: string | null; custom: string } {
  if (!grams) return { size: null, custom: '' }
  const chip = SIZE_CHIPS.find((c) => c.value === String(grams))
  return chip ? { size: chip.value, custom: '' } : { size: 'other', custom: String(grams) }
}

export function BagStep({ beanId, name, roaster, initial, onBack, onSubmit }: BagStepProps) {
  const cover = beanCover(beanId)
  const [roast, setRoast] = useState<string | null>(initial?.roastDate ? 'pick' : null)
  const [pickedDate, setPickedDate] = useState(initial?.roastDate ? formatDMY(initial.roastDate) : '')
  const [size, setSize] = useState<string | null>(() => initialSize(initial?.grams).size)
  const [custom, setCustom] = useState(() => initialSize(initial?.grams).custom)
  const filled = initial?.roastDate && initial.grams ? 'Roast date and size' : initial?.roastDate ? 'Roast date' : initial?.grams ? 'Size' : null
  const [error, setError] = useState<string | null>(null)

  const today = daysAgo(0)
  const oldest = daysAgo(730)

  function submit() {
    let roastDate: string | null = null
    const chip = ROAST_CHIPS.find((c) => c.value === roast)
    if (chip && 'days' in chip) roastDate = daysAgo(chip.days)
    if (roast === 'pick') {
      if (!pickedDate.trim()) return setError('Enter a date, or choose another option')
      const parsed = parseDMY(pickedDate)
      if (!parsed) return setError('Enter the date as dd/mm/yyyy')
      if (parsed > today || parsed < oldest) return setError('Choose a date in the last two years')
      roastDate = parsed
    }

    let grams: number | null = null
    if (size === 'other') {
      const value = Number(custom)
      if (!custom.trim() || !Number.isFinite(value) || value < 1 || value > 5000) {
        return setError('Enter a size between 1 and 5000 g')
      }
      grams = value
    } else if (size) {
      grams = Number(size)
    }

    onSubmit({ roastDate, grams })
  }

  return (
    <div className="space-y-4 px-3 pb-2">
      <button type="button" onClick={onBack} className="h-9 rounded-full bg-soft px-4 text-sm">
        ← Back
      </button>

      <div className="flex items-center gap-3 px-1">
        <span className={`size-12 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{roaster}</span>
        </span>
      </div>

      {filled && (
        <p className="rounded-2xl bg-accent-soft px-3 py-2 text-sm text-accent">
          {filled} filled in from your photo. Check before adding.
        </p>
      )}

      <div>
        <p className="px-2 text-xs text-muted">Roast date</p>
        <div className="mt-1">
          <ChipGroup
            label="Roast date"
            options={ROAST_CHIPS.map(({ value, label }) => ({ value, label }))}
            value={roast}
            onChange={(next) => {
              setRoast(next)
              setError(null)
            }}
          />
        </div>
        {roast === 'pick' && (
          <label className="mt-2 block">
            <span className="sr-only">Roast date</span>
            <input
              value={pickedDate}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="dd/mm/yyyy"
              onChange={(event) => {
                setPickedDate(maskDMY(event.target.value))
                setError(null)
              }}
              className="num h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        )}
      </div>

      <div>
        <p className="px-2 text-xs text-muted">Bag size</p>
        <div className="mt-1">
          <ChipGroup
            label="Bag size"
            options={SIZE_CHIPS.map(({ value, label }) => ({ value, label }))}
            value={size}
            onChange={(next) => {
              setSize(next)
              setError(null)
            }}
          />
        </div>
        {size === 'other' && (
          <label className="mt-2 block">
            <span className="sr-only">Bag size in grams</span>
            <input
              value={custom}
              inputMode="decimal"
              placeholder="Grams"
              onChange={(event) => {
                setCustom(event.target.value)
                setError(null)
              }}
              className="h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="px-2 text-sm text-accent">
          {error}
        </p>
      )}

      <button type="button" onClick={submit} className="h-12 w-full rounded-full bg-ink font-medium text-bg active:scale-[0.98]">
        Add to my beans
      </button>
    </div>
  )
}
