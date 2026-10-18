import { useState, type FormEvent } from 'react'
import { ChipGroup } from '../components/ChipGroup'
import { MultiChipGroup } from '../components/MultiChipGroup'
import { useBeanSearch } from '../data/hooks'
import type { BeanMatch, NewBean, RoastLevel } from '../data/types'
import { FLAVOURS, ORIGINS, PROCESSES, VARIETIES, composeProcess, parseProcess } from './lists'
import { TagInput } from './TagInput'
import { useDebouncedValue } from './useDebouncedValue'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'

interface NewBeanStepProps {
  /** The details entered earlier, restored when you come back from the next step. */
  draft?: NewBean
  initialRoaster: string
  initialName: string
  /** Known roasters, offered as type-ahead on the roaster field. */
  roasters: string[]
  /** The draft was read from a bag photo, so say so and ask for a check. */
  fromPhoto?: boolean
  onBack: () => void
  onContinue: (bean: NewBean) => void
  onPickExisting: (bean: BeanMatch) => void
}

const label = 'px-2 text-xs text-muted'

export function NewBeanStep({ draft, initialRoaster, initialName, roasters, fromPhoto = false, onBack, onContinue, onPickExisting }: NewBeanStepProps) {
  const [roaster, setRoaster] = useState(draft?.roaster ?? initialRoaster)
  const [name, setName] = useState(draft?.name ?? initialName)
  const [origin, setOrigin] = useState(draft?.origin ?? '')
  const [region, setRegion] = useState(draft?.region ?? '')
  const [process, setProcess] = useState(() => parseProcess(draft?.process))
  const [roastLevel, setRoastLevel] = useState<RoastLevel | null>(draft?.roastLevel ?? null)
  const [notes, setNotes] = useState<string[]>(draft?.roasterNotes ?? [])
  const [variety, setVariety] = useState(draft?.variety ?? '')
  const [altitude, setAltitude] = useState(draft?.altitudeM ? String(draft.altitudeM) : '')
  const [producer, setProducer] = useState(draft?.producer ?? '')
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
      process: composeProcess(process.chips, process.other) || undefined,
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

      {fromPhoto && (
        <p className="rounded-2xl bg-accent-soft px-3 py-2 text-sm text-accent">
          Filled in from your photo. Check it, and add anything the label didn't say.
        </p>
      )}

      <div className="space-y-3">
        <TextField
          label="Roaster"
          value={roaster}
          onChange={(e) => {
            setRoaster(e.target.value)
            setErrors((p) => ({ ...p, roaster: undefined }))
          }}
          error={errors.roaster}
          autoComplete="off"
          list="roasters"
          autoFocus={!initialRoaster}
        />
        <datalist id="roasters">
          {roasters.map((known) => (
            <option key={known} value={known} />
          ))}
        </datalist>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setErrors((p) => ({ ...p, name: undefined }))
          }}
          error={errors.name}
          autoFocus={!!initialRoaster && !initialName}
        />
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
        <TextField label="Origin" value={origin} onChange={(e) => setOrigin(e.target.value)} list="origins" />
        <datalist id="origins">
          {ORIGINS.map((country) => (
            <option key={country} value={country} />
          ))}
        </datalist>
        <TextField label="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      <TextField label="Variety" value={variety} onChange={(e) => setVariety(e.target.value)} list="varieties" placeholder="e.g. Geisha, Bourbon" />
      <datalist id="varieties">
        {VARIETIES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div>
        <p className={label}>Process</p>
        <div className="mt-1">
          <MultiChipGroup label="Process" options={PROCESSES.map((p) => ({ value: p, label: p }))} value={process.chips} onChange={(chips) => setProcess((p) => ({ ...p, chips }))} />
        </div>
        <p className="mt-1 px-2 text-xs text-muted">Pick more than one when it applies, like Anaerobic and Washed.</p>
        <TextField
          value={process.other}
          onChange={(e) => setProcess((p) => ({ ...p, other: e.target.value }))}
          aria-label="Other process"
          placeholder="Something else, e.g. Carbonic maceration"
          className="mt-2"
          maxLength={60}
        />
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
          <TextField
            label="Altitude (m)"
            value={altitude}
            onChange={(e) => {
              setAltitude(e.target.value)
              setErrors((p) => ({ ...p, altitude: undefined }))
            }}
            inputMode="numeric"
            error={errors.altitude}
            tone="bg"
          />
          <TextField label="Producer" value={producer} onChange={(e) => setProducer(e.target.value)} tone="bg" />
        </div>
      </details>

      <Button type="submit">
        Continue
      </Button>
    </form>
  )
}
