import { useState, type FormEvent } from 'react'
import { Sheet } from '../components/Sheet'
import type { FilterRow, NewFilter } from '../data/types'
import { useOnOpen } from '../hooks/useOnOpen'
import { CatalogueStatus } from './CatalogueStatus'
import { filterName, filterNote } from './gearLabels'
import { TextField } from '../components/TextField'

interface AddFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Undefined while the catalogue loads or after it failed. */
  catalogue: FilterRow[] | undefined
  catalogueFailed: boolean
  onRetry: () => void
  ownedIds: Set<string>
  onAdd: (filterId: string) => void
  onCreate: (input: NewFilter) => void
}


export function AddFilterSheet({
  open,
  onOpenChange,
  catalogue,
  catalogueFailed,
  onRetry,
  ownedIds,
  onAdd,
  onCreate,
}: AddFilterSheetProps) {
  const [mode, setMode] = useState<'pick' | 'create'>('pick')
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [size, setSize] = useState('')
  const [material, setMaterial] = useState<NewFilter['material']>('paper')
  const [flow, setFlow] = useState<'' | 'fast' | 'medium' | 'slow'>('')
  const [error, setError] = useState<string | null>(null)

  const available = (catalogue ?? []).filter(
    (f) => !ownedIds.has(f.id) && filterName(f).toLowerCase().includes(query.trim().toLowerCase()),
  )

  function reset() {
    setMode('pick')
    setQuery('')
    setBrand('')
    setModel('')
    setSize('')
    setMaterial('paper')
    setFlow('')
    setError(null)
  }
  useOnOpen(open, reset)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!brand.trim() || !model.trim()) return setError('Enter a brand and a model')
    onCreate({ brand, model, size, material, flowClass: flow || undefined })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'pick' ? 'Add a filter' : 'New filter'}
    >
      {mode === 'pick' ? (
        <div className="space-y-2 px-3 pb-2">
          <TextField aria-label="Search filters" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filters" />
          {!catalogue ? (
            <CatalogueStatus failed={catalogueFailed} onRetry={onRetry} />
          ) : available.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">No filter matches that search.</p>
          ) : (
            <ul className="space-y-1">
              {available.map((filter) => (
                <li key={filter.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(filter.id)
                      onOpenChange(false)
                    }}
                    className="flex min-h-12 w-full flex-col justify-center rounded-3xl px-5 py-2 text-left active:bg-soft"
                  >
                    <span>{filterName(filter)}</span>
                    <span className="text-xs text-muted">{filterNote(filter)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setMode('create')}
            className="h-12 w-full rounded-full bg-accent-soft text-accent active:scale-[0.98]"
          >
            Can't find yours? Add a new filter
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 px-3 pb-2">
          <TextField aria-label="Brand" placeholder="Brand, e.g. CAFEC" value={brand} onChange={(e) => { setBrand(e.target.value); setError(null) }} />
          <TextField aria-label="Model" placeholder="Model, e.g. T-90" value={model} onChange={(e) => { setModel(e.target.value); setError(null) }} />
          <TextField aria-label="Size" placeholder="Size, e.g. 02 (optional)" value={size} onChange={(e) => setSize(e.target.value)} />
          <label className="flex items-center justify-between gap-3 px-2 text-sm">
            <span className="text-muted">Material</span>
            <select value={material} onChange={(e) => setMaterial(e.target.value as NewFilter['material'])} className="h-10 rounded-full bg-soft px-4">
              <option value="paper">Paper</option>
              <option value="metal">Metal</option>
              <option value="cloth">Cloth</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 px-2 text-sm">
            <span className="text-muted">How fast does it drain?</span>
            <select value={flow} onChange={(e) => setFlow(e.target.value as typeof flow)} className="h-10 rounded-full bg-soft px-4">
              <option value="">Not sure</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="px-2 text-sm text-accent">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('pick')} className="h-12 rounded-full bg-soft px-6">
              Back
            </button>
            <button type="submit" className="h-12 flex-1 rounded-full bg-ink font-medium text-bg active:scale-[0.98]">
              Add filter
            </button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
