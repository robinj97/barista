import { useState } from 'react'
import { ChoiceSheet } from '../components/ChoiceSheet'
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

interface GearCardProps {
  grinders: MyGrinder[]
  grinder: MyGrinder | undefined
  filters: MyFilter[]
  filter: MyFilter | null
  onGrinder: (grinderId: string) => void
  onFilter: (filterId: string) => void
}

const addButton = 'h-11 w-full rounded-full bg-accent-soft text-accent transition-transform active:scale-[0.98]'

/** Grinder and filter for this brew, with an inline way to add one you have not set up yet. */
export function GearCard({ grinders, grinder, filters, filter, onGrinder, onFilter }: GearCardProps) {
  const [addingGrinder, setAddingGrinder] = useState(false)
  const [addingFilter, setAddingFilter] = useState(false)
  const grinderCatalogue = useGrinderCatalogue()
  const filterCatalogue = useFilterCatalogue()
  const addGrinder = useAddGrinder()
  const addFilter = useAddFilter()
  const createFilter = useCreateAndAddFilter()

  return (
    <section aria-label="Your gear" className="mt-6">
      <h2 className="px-2 text-xs font-medium text-muted">Your gear</h2>
      <div className="squircle mt-2 space-y-2 rounded-4xl bg-soft p-2">
        {grinder ? (
          <div>
            <ChoiceSheet
              tone="bg"
              title="Grinder"
              options={grinders.map((g) => ({ value: g.grinder.id, label: grinderName(g.grinder) }))}
              value={grinder.grinder.id}
              onChange={onGrinder}
            />
            {grinderNote(grinder.grinder) && (
              <p className="px-5 pt-1 text-xs text-muted">{grinderNote(grinder.grinder)}</p>
            )}
          </div>
        ) : (
          <div className="px-3 pt-2">
            <p className="px-2 pb-2 text-sm text-muted">Add your grinder to see the grind in clicks. Until then it shows in microns.</p>
            <button type="button" onClick={() => setAddingGrinder(true)} className={addButton}>
              Add your grinder
            </button>
          </div>
        )}

        {filters.length > 0 ? (
          <ChoiceSheet
            tone="bg"
            title="Filter"
            options={[{ value: 'none', label: 'No filter' }, ...filters.map((f) => ({ value: f.filter.id, label: filterName(f.filter) }))]}
            value={filter?.filter.id ?? 'none'}
            onChange={onFilter}
          />
        ) : (
          <div className="px-3 pb-2">
            <button type="button" onClick={() => setAddingFilter(true)} className={addButton}>
              Add a filter (optional)
            </button>
          </div>
        )}
      </div>

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
