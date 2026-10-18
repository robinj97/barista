import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import {
  useAddFilter,
  useAddGrinder,
  useCreateAndAddFilter,
  useFilterCatalogue,
  useGrinderCatalogue,
} from '../data/hooks'
import type { MyFilter, MyGrinder } from '../data/types'
import { AddFilterSheet } from '../profile/AddFilterSheet'
import { AddGrinderSheet } from '../profile/AddGrinderSheet'
import { filterName, grinderName, grinderNote } from '../profile/gearLabels'
import { Button } from '../components/Button'

interface GearCardProps {
  grinders: MyGrinder[]
  grinder: MyGrinder | undefined
  filters: MyFilter[]
  filter: MyFilter | null
  onGrinder: (grinderId: string) => void
  onFilter: (filterId: string) => void
}

const addButton = 'h-11 w-full rounded-full bg-accent-soft text-accent transition-transform active:scale-[0.98]'

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  )
}

function Choice({ label, note, selected, onPick }: { label: string; note?: string | null; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-full px-5 py-2 text-left transition-colors ${selected ? 'bg-accent-soft' : 'active:bg-soft'}`}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {note && <span className="block text-xs text-muted">{note}</span>}
      </span>
      {selected && <span className="shrink-0 text-sm text-accent">Selected</span>}
    </button>
  )
}

/**
 * Your grinder and filter for this brew, as one slim line you rarely need to touch: the gear of your
 * last brew is already chosen. The pencil opens the lists. With no grinder yet, a prompt to add one.
 */
export function GearCard({ grinders, grinder, filters, filter, onGrinder, onFilter }: GearCardProps) {
  const [editing, setEditing] = useState(false)
  const [addingGrinder, setAddingGrinder] = useState(false)
  const [addingFilter, setAddingFilter] = useState(false)
  const grinderCatalogue = useGrinderCatalogue()
  const filterCatalogue = useFilterCatalogue()
  const addGrinder = useAddGrinder()
  const addFilter = useAddFilter()
  const createFilter = useCreateAndAddFilter()

  const summary = grinder ? `${grinderName(grinder.grinder)} · ${filter ? filterName(filter.filter) : 'No filter'}` : ''

  return (
    <section aria-label="Your gear" className="mt-6">
      {grinder ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit your gear: ${summary}`}
          className="squircle flex h-12 w-full items-center gap-3 rounded-full bg-soft pr-2 pl-5 text-left transition-transform active:scale-[0.98]"
        >
          <span className="shrink-0 text-xs text-muted">Gear</span>
          <span className="min-w-0 flex-1 truncate text-sm">{summary}</span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-muted">
            <PencilIcon />
          </span>
        </button>
      ) : (
        <div className="squircle rounded-4xl bg-soft p-2">
          <div className="px-3 pt-2">
            <p className="px-2 pb-2 text-sm text-muted">Add your grinder to see the grind in clicks. Until then it shows in microns.</p>
            <button type="button" onClick={() => setAddingGrinder(true)} className={addButton}>
              Add your grinder
            </button>
          </div>
          <div className="h-2" />
        </div>
      )}

      <Sheet open={editing} onOpenChange={setEditing} title="Your gear">
        <div className="space-y-4 px-1 pb-2">
          <div>
            <h3 className="px-4 pb-1 text-xs font-medium text-muted">Grinder</h3>
            <div role="radiogroup" aria-label="Grinder" className="space-y-1">
              {grinders.map((g) => (
                <Choice key={g.grinder.id} label={grinderName(g.grinder)} note={grinderNote(g.grinder)} selected={g.grinder.id === grinder?.grinder.id} onPick={() => onGrinder(g.grinder.id)} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setAddingGrinder(true)
              }}
              className="mt-1 h-11 w-full rounded-full text-sm text-accent"
            >
              Add a grinder
            </button>
          </div>

          <div>
            <h3 className="px-4 pb-1 text-xs font-medium text-muted">Filter</h3>
            <div role="radiogroup" aria-label="Filter" className="space-y-1">
              <Choice label="No filter" selected={!filter} onPick={() => onFilter('none')} />
              {filters.map((f) => (
                <Choice key={f.filter.id} label={filterName(f.filter)} selected={f.filter.id === filter?.filter.id} onPick={() => onFilter(f.filter.id)} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setAddingFilter(true)
              }}
              className="mt-1 h-11 w-full rounded-full text-sm text-accent"
            >
              Add a filter
            </button>
          </div>

          <Button onClick={() => setEditing(false)}>
            Done
          </Button>
        </div>
      </Sheet>

      <AddGrinderSheet
        open={addingGrinder}
        onOpenChange={setAddingGrinder}
        catalogue={grinderCatalogue.data}
        catalogueFailed={grinderCatalogue.isError}
        onRetry={() => void grinderCatalogue.refetch()}
        ownedIds={new Set(grinders.map((g) => g.grinder.id))}
        onAdd={(id) => addGrinder.mutate(id)}
      />
      <AddFilterSheet
        open={addingFilter}
        onOpenChange={setAddingFilter}
        catalogue={filterCatalogue.data}
        catalogueFailed={filterCatalogue.isError}
        onRetry={() => void filterCatalogue.refetch()}
        ownedIds={new Set(filters.map((f) => f.filter.id))}
        onAdd={(id) => addFilter.mutate(id)}
        onCreate={(input) => createFilter.mutate(input)}
      />
    </section>
  )
}
