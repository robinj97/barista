import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import type { CatalogueGrinder } from '../data/types'
import { useOnOpen } from '../hooks/useOnOpen'
import { CatalogueStatus } from './CatalogueStatus'
import { grinderName, grinderNote } from './gearLabels'
import { TextField } from '../components/TextField'

interface AddGrinderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Undefined while the catalogue loads or after it failed. */
  catalogue: CatalogueGrinder[] | undefined
  catalogueFailed: boolean
  onRetry: () => void
  ownedIds: Set<string>
  onAdd: (grinderId: string) => void
}

export function AddGrinderSheet({ open, onOpenChange, catalogue, catalogueFailed, onRetry, ownedIds, onAdd }: AddGrinderSheetProps) {
  const [query, setQuery] = useState('')
  useOnOpen(open, () => setQuery(''))
  const available = (catalogue ?? []).filter(
    (g) => !ownedIds.has(g.id) && grinderName(g).toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a grinder">
      <div className="space-y-2 px-3 pb-2">
        <TextField aria-label="Search grinders" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search grinders" />
        {!catalogue ? (
          <CatalogueStatus failed={catalogueFailed} onRetry={onRetry} />
        ) : available.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">
            {catalogue.every((g) => ownedIds.has(g.id)) ? 'You have added every grinder we list.' : 'No grinder matches that search.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {available.map((grinder) => (
              <li key={grinder.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(grinder.id)
                    onOpenChange(false)
                  }}
                  className="flex min-h-12 w-full flex-col justify-center rounded-3xl px-5 py-2 text-left active:bg-soft"
                >
                  <span>{grinderName(grinder)}</span>
                  {grinderNote(grinder) && <span className="text-xs text-muted">{grinderNote(grinder)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
