import { useState } from 'react'
import { ChipGroup } from '../components/ChipGroup'
import { beanCover } from './cover'
import { daysAgo } from './dates'

export interface BagDetails {
  roastDate: string | null
  grams: number | null
}

interface BagStepProps {
  beanId: string
  name: string
  roaster: string
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

export function BagStep({ beanId, name, roaster, onBack, onSubmit }: BagStepProps) {
  const cover = beanCover(beanId)
  const [roast, setRoast] = useState<string | null>(null)
  const [pickedDate, setPickedDate] = useState('')
  const [size, setSize] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)

  const today = daysAgo(0)
  const oldest = daysAgo(730)

  function submit() {
    let roastDate: string | null = null
    const chip = ROAST_CHIPS.find((c) => c.value === roast)
    if (chip && 'days' in chip) roastDate = daysAgo(chip.days)
    if (roast === 'pick') {
      if (!pickedDate) return setError('Pick a date, or choose another option')
      if (pickedDate > today || pickedDate < oldest) return setError('Choose a date in the last two years')
      roastDate = pickedDate
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
              type="date"
              value={pickedDate}
              min={oldest}
              max={today}
              onChange={(event) => {
                setPickedDate(event.target.value)
                setError(null)
              }}
              className="h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
