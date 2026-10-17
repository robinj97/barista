import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/Avatar'
import { ChoiceSheet } from '../components/ChoiceSheet'
import { SegmentedControl } from '../components/SegmentedControl'
import {
  useAddFilter,
  useAddGrinder,
  useCreateAndAddFilter,
  useFilterCatalogue,
  useGrinderCatalogue,
  useMyFilters,
  useMyGrinders,
  useProfile,
  useRemoveFilter,
  useRemoveGrinder,
  useSetDefaultFilter,
  useUpdateProfile,
} from '../data/hooks'
import { METHOD_OPTIONS, type Method } from '../data/types'
import type { TempUnit } from '../../engine/units.ts'
import { AddFilterSheet } from '../profile/AddFilterSheet'
import { AddGrinderSheet } from '../profile/AddGrinderSheet'
import { EditNameSheet } from '../profile/EditNameSheet'
import { filterName, filterNote, grinderName, grinderNote } from '../profile/gearLabels'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="px-2 text-xs font-medium text-muted">{title}</h2>
      <div className="squircle mt-2 rounded-4xl bg-soft p-2">{children}</div>
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex min-h-14 items-center gap-3 rounded-3xl px-3 py-2">{children}</div>
}

const pillButton =
  'h-9 shrink-0 rounded-full bg-bg px-4 text-sm transition-transform active:scale-[0.98] disabled:opacity-60'

function ErrorNote({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p role="alert" className="px-4 py-2 text-sm text-accent">
      Couldn't save that. Check your connection and try again.
    </p>
  )
}

export function ProfilePage() {
  const { session, signOut } = useAuth()
  const profile = useProfile()
  const update = useUpdateProfile()

  const grinderCatalogue = useGrinderCatalogue()
  const myGrinders = useMyGrinders()
  const addGrinder = useAddGrinder()
  const removeGrinder = useRemoveGrinder()

  const filterCatalogue = useFilterCatalogue()
  const myFilters = useMyFilters()
  const addFilter = useAddFilter()
  const createFilter = useCreateAndAddFilter()
  const setDefault = useSetDefaultFilter()
  const removeFilter = useRemoveFilter()

  const [editingName, setEditingName] = useState(false)
  const [addingGrinder, setAddingGrinder] = useState(false)
  const [addingFilter, setAddingFilter] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const meta = session?.user.user_metadata as { avatar_url?: string; picture?: string } | undefined
  const data = profile.data

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          // Back to the tab that opened the profile; Beans when it was opened directly.
          onClick={() => (location.key === 'default' ? navigate('/beans') : navigate(-1))}
          className="grid size-11 place-items-center rounded-full bg-soft text-lg"
        >
          ←
        </button>
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Profile</h1>
      </div>

      {profile.isError && (
        <p role="alert" className="mt-6 text-sm text-accent">
          Couldn't load your profile.{' '}
          <button type="button" onClick={() => void profile.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}

      {data && (
        <>
          <Card title="Account">
            <Row>
              <Avatar name={data.display_name} url={data.avatar_url ?? meta?.avatar_url ?? meta?.picture} className="size-14" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{data.display_name}</span>
                <span className="block truncate text-xs text-muted">{session?.user.email}</span>
              </span>
              <button type="button" onClick={() => setEditingName(true)} className={pillButton}>
                Edit name
              </button>
            </Row>
            <ErrorNote show={update.isError && update.variables?.display_name !== undefined} />
          </Card>

          <Card title="Defaults">
            <Row>
              <span className="flex-1">Temperature</span>
              <SegmentedControl<TempUnit>
                label="Temperature unit"
                options={[
                  { value: 'c', label: '°C' },
                  { value: 'f', label: '°F' },
                ]}
                value={data.temp_unit}
                onChange={(temp_unit) => update.mutate({ temp_unit })}
              />
            </Row>
            <div className="px-1 pb-1">
              <ChoiceSheet<Method>
                tone="bg"
                title="Default method"
                options={METHOD_OPTIONS}
                value={data.default_method}
                onChange={(default_method) => update.mutate({ default_method })}
              />
            </div>
            <ErrorNote show={update.isError && update.variables?.display_name === undefined} />
          </Card>
        </>
      )}

      <Card title="My grinders">
        {myGrinders.isError && <ErrorNote show />}
        {myGrinders.data && myGrinders.data.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted">
            Add the grinders you use. We'll convert friends' recipes to your settings.
          </p>
        )}
        <ul>
          {myGrinders.data?.map(({ grinder }) => (
            <li key={grinder.id}>
              <Row>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{grinderName(grinder)}</span>
                  {grinderNote(grinder) && <span className="block text-xs text-muted">{grinderNote(grinder)}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${grinderName(grinder)}`}
                  onClick={() => removeGrinder.mutate(grinder.id)}
                  className={pillButton}
                >
                  Remove
                </button>
              </Row>
            </li>
          ))}
        </ul>
        <ErrorNote show={addGrinder.isError || removeGrinder.isError} />
        <div className="p-1">
          <button type="button" onClick={() => setAddingGrinder(true)} className="h-12 w-full rounded-full bg-bg active:scale-[0.98]">
            Add grinder
          </button>
        </div>
      </Card>

      <Card title="My filters">
        {myFilters.isError && <ErrorNote show />}
        {myFilters.data && myFilters.data.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted">Add the filter papers you use. They appear when you set up a recipe.</p>
        )}
        <ul>
          {myFilters.data?.map(({ filter, isDefault }) => (
            <li key={filter.id}>
              <Row>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{filterName(filter)}</span>
                  <span className="block text-xs text-muted">{filterNote(filter)}</span>
                </span>
                {isDefault ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1.5 text-xs text-accent">Default</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Make ${filterName(filter)} the default`}
                    onClick={() => setDefault.mutate(filter.id)}
                    className={pillButton}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${filterName(filter)}`}
                  onClick={() => removeFilter.mutate(filter.id)}
                  className={pillButton}
                >
                  Remove
                </button>
              </Row>
            </li>
          ))}
        </ul>
        <ErrorNote show={addFilter.isError || createFilter.isError || setDefault.isError || removeFilter.isError} />
        <div className="p-1">
          <button type="button" onClick={() => setAddingFilter(true)} className="h-12 w-full rounded-full bg-bg active:scale-[0.98]">
            Add filter
          </button>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-8 h-12 w-full rounded-full bg-soft font-medium active:scale-[0.98]"
      >
        Sign out
      </button>

      {data && (
        <EditNameSheet
          open={editingName}
          onOpenChange={setEditingName}
          initialName={data.display_name}
          onSave={(display_name) => update.mutate({ display_name })}
        />
      )}
      <AddGrinderSheet
        open={addingGrinder}
        onOpenChange={setAddingGrinder}
        catalogue={grinderCatalogue.data}
        catalogueFailed={grinderCatalogue.isError}
        onRetry={() => void grinderCatalogue.refetch()}
        ownedIds={new Set(myGrinders.data?.map((g) => g.grinder.id))}
        onAdd={(id) => addGrinder.mutate(id)}
      />
      <AddFilterSheet
        open={addingFilter}
        onOpenChange={setAddingFilter}
        catalogue={filterCatalogue.data}
        catalogueFailed={filterCatalogue.isError}
        onRetry={() => void filterCatalogue.refetch()}
        ownedIds={new Set(myFilters.data?.map((f) => f.filter.id))}
        onAdd={(id) => addFilter.mutate(id)}
        onCreate={(input) => createFilter.mutate(input)}
      />
    </>
  )
}
