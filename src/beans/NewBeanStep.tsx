import { useState, type FormEvent } from 'react'
import { ChipGroup } from '../components/ChipGroup'
import { useBeanSearch } from '../data/hooks'
import type { BeanMatch, NewBean, RoastLevel } from '../data/types'
import { FLAVOURS, ORIGINS, PROCESSES } from './lists'
import { TagInput } from './TagInput'
import { useDebouncedValue } from './useDebouncedValue'

interface NewBeanStepProps {
  initialName: string
  onBack: () => void
  onContinue: (bean: NewBean) => void
  onPickExisting: (bean: BeanMatch) => void
}

const field = 'h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent'
const label = 'px-2 text-xs text-muted'

export function NewBeanStep({ initialName, onBack, onContinue, onPickExisting }: NewBeanStepProps) {
  const [roaster, setRoaster] = useState('')
  const [name, setName] = useState(initialName)
  const [origin, setOrigin] = useState('')
  const [region, setRegion] = useState('')
  const [process, setProcess] = useState<string | null>(null)
  const [roastLevel, setRoastLevel] = useState<RoastLevel | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [variety, setVariety] = useState('')
  const [altitude, setAltitude] = useState('')
  const [producer, setProducer] = useState('')
  const [errors, setErrors] = useState<{ roaster?: string; name?: string; altitude?: string }>({})

  // "Did you mean...?": near matches while the roaster and name are typed.
  const probe = useDebouncedValue(`${roaster} ${name}`.trim())
  const similar = useBeanSearch(roaster.trim().length >= 2 && name.trim().length >= 2 ? probe : '')
  const nearby = (similar.data ?? []).slice(0, 2)

  function submit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!roaster.trim()) next.roaster = 'Enter a roaster'
    else if (roaster.trim().length > 80) next.roaster = 'Keep it to 80 characters'
    if (!name.trim()) next.name = 'Enter a name'
    else if (name.trim().length > 120) next.name = 'Keep it to 120 characters'
    const metres = altitude.trim() ? Number(altitude) : undefined
    if (metres !== undefined && (!Number.isInteger(metres) || metres < 1 || metres > 5000)) {
      next.altitude = 'Enter metres, 1 to 5000'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    onContinue({
      roaster: roaster.trim(),
      name: name.trim(),
      origin: origin.trim() || undefined,
      region: region.trim() || undefined,
      process: process ?? undefined,
      roastLevel: roastLevel ?? undefined,
      roasterNotes: notes,
      variety: variety.trim() || undefined,
      altitudeM: metres,
      producer: producer.trim() || undefined,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-3 pb-2" noValidate>
      <button type="button" onClick={onBack} className="h-9 rounded-full bg-soft px-4 text-sm">
        ← Back to search
      </button>

      <div className="space-y-3">
        <label className="block">
          <span className={label}>Roaster</span>
          <input value={roaster} onChange={(e) => { setRoaster(e.target.value); setErrors((p) => ({ ...p, roaster: undefined })) }} className={`${field} mt-1`} aria-invalid={!!errors.roaster} autoComplete="organization" />
          {errors.roaster && <span role="alert" className="mt-1 block px-2 text-sm text-accent">{errors.roaster}</span>}
        </label>
        <label className="block">
          <span className={label}>Name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })) }} className={`${field} mt-1`} aria-invalid={!!errors.name} />
          {errors.name && <span role="alert" className="mt-1 block px-2 text-sm text-accent">{errors.name}</span>}
        </label>
      </div>

      {nearby.length > 0 && (
        <div className="rounded-3xl bg-accent-soft p-3">
          <p className="px-1 text-sm text-accent">Did you mean one of these?</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nearby.map((bean) => (
              <li key={bean.id}>
                <button type="button" onClick={() => onPickExisting(bean)} className="h-9 rounded-full bg-bg px-4 text-sm">
                  Use {bean.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={label}>Origin</span>
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} list="origins" className={`${field} mt-1`} />
          <datalist id="origins">
            {ORIGINS.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={label}>Region</span>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>

      <div>
        <p className={label}>Process</p>
        <div className="mt-1">
          <ChipGroup label="Process" options={PROCESSES.map((p) => ({ value: p, label: p }))} value={process as (typeof PROCESSES)[number] | null} onChange={setProcess} />
        </div>
      </div>

      <div>
        <p className={label}>Roast level</p>
        <div className="mt-1">
          <ChipGroup<RoastLevel>
            label="Roast level"
            options={[{ value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'dark', label: 'Dark' }]}
            value={roastLevel}
            onChange={setRoastLevel}
          />
        </div>
      </div>

      <TagInput label="Tasting notes from the bag" value={notes} onChange={setNotes} suggestions={FLAVOURS} />

      <details className="rounded-3xl bg-soft px-4 py-2">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm text-muted">More details</summary>
        <div className="space-y-3 pt-2 pb-2">
          <label className="block">
            <span className={label}>Variety</span>
            <input value={variety} onChange={(e) => setVariety(e.target.value)} className={`${field} mt-1 bg-bg`} />
          </label>
          <label className="block">
            <span className={label}>Altitude (m)</span>
            <input value={altitude} onChange={(e) => { setAltitude(e.target.value); setErrors((p) => ({ ...p, altitude: undefined })) }} inputMode="numeric" className={`${field} mt-1 bg-bg`} />
            {errors.altitude && <span role="alert" className="mt-1 block px-2 text-sm text-accent">{errors.altitude}</span>}
          </label>
          <label className="block">
            <span className={label}>Producer</span>
            <input value={producer} onChange={(e) => setProducer(e.target.value)} className={`${field} mt-1 bg-bg`} />
          </label>
        </div>
      </details>

      <button type="submit" className="h-12 w-full rounded-full bg-ink font-medium text-bg active:scale-[0.98]">
        Continue
      </button>
    </form>
  )
}
