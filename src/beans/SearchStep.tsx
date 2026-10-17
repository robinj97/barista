import { useBeanCatalogue, useBeanSearch } from '../data/hooks'
import { BROWSE_LIMIT, type BeanMatch } from '../data/types'
import { groupByRoaster, refineCatalogue } from './catalogue'
import { beanCover } from './cover'
import { splitKnownRoaster, type Prefill } from './roasters'
import { useDebouncedValue } from './useDebouncedValue'

interface SearchStepProps {
  query: string
  onQueryChange: (query: string) => void
  onPick: (bean: BeanMatch) => void
  /** Roasters already in the catalogue, so a typed roaster is not mistaken for a bean name. */
  roasters: string[]
  onAddNew: (prefill: Prefill) => void
}

function friendsLabel(count: number): string {
  return count === 1 ? 'A friend has this dialed in' : `${count} friends have this dialed in`
}

function BeanRow({ bean, showRoaster, onPick }: { bean: BeanMatch; showRoaster: boolean; onPick: () => void }) {
  const cover = beanCover(bean.id)
  const details = [showRoaster ? bean.roaster : null, bean.origin, bean.process].filter(Boolean).join(' · ')
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-left active:bg-soft"
      >
        <span className={`size-9 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{bean.name}</span>
          {details && <span className="block truncate text-xs text-muted">{details}</span>}
        </span>
        {bean.owned ? (
          <span className="shrink-0 rounded-full bg-soft px-2.5 py-0.5 text-xs text-muted">
            <span aria-hidden>Yours</span>
            <span className="sr-only">In your beans</span>
          </span>
        ) : (
          bean.friendsWithRecipe > 0 && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
              <span aria-hidden>{bean.friendsWithRecipe === 1 ? '1 friend' : `${bean.friendsWithRecipe} friends`}</span>
              <span className="sr-only">{friendsLabel(bean.friendsWithRecipe)}</span>
            </span>
          )
        )}
      </button>
    </li>
  )
}

/**
 * The catalogue, alphabetical and grouped by roaster, narrowing on the device with every key.
 * Made for the keyboard being up: the search box stays at the top, rows are compact, and
 * adding something new is one row pinned at the bottom, right above the keyboard.
 */
export function SearchStep({ query, onQueryChange, onPick, roasters, onAddNew }: SearchStepProps) {
  const typed = query.trim()
  const catalogue = useBeanCatalogue()
  const all = catalogue.data ?? []
  const local = refineCatalogue(all, typed)

  // The server's fuzzy search catches typos the list cannot, and covers a catalogue too big to
  // send whole. It only runs when the list on the device is not enough.
  const partial = catalogue.isError || all.length >= BROWSE_LIMIT
  const needServer = typed.length >= 2 && (partial || (catalogue.isSuccess && local.length === 0))
  const debounced = useDebouncedValue(needServer ? query : '')
  const search = useBeanSearch(debounced)
  const localIds = new Set(local.map((bean) => bean.id))
  const extra = needServer ? (search.data ?? []).filter((bean) => !localIds.has(bean.id)) : []

  const groups = groupByRoaster(local)
  const known = splitKnownRoaster(typed, roasters)
  const nothing = local.length === 0 && extra.length === 0

  return (
    <div className="flex min-h-full flex-col">
      <label className="sticky top-0 z-20 block bg-bg pb-2">
        <span className="sr-only">Search roaster or bean</span>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search roaster or bean"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          className="h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      {catalogue.isPending && (
        <p className="px-3 py-3 text-sm text-muted" role="status">
          Loading beans…
        </p>
      )}

      {catalogue.isSuccess && all.length === 0 && !typed && (
        <p className="px-3 py-3 text-sm text-muted">No beans yet. Type the roaster or bean to add the first.</p>
      )}

      {catalogue.isError && search.isError && (
        <p role="alert" className="px-3 py-3 text-sm text-accent">
          Couldn't load beans just now. You can still add it yourself below.
        </p>
      )}

      {groups.length > 0 && (
        <div>
          {groups.map((group) => (
            <div key={group.roaster.toLowerCase()}>
              <h3 className="sticky top-14 z-10 bg-bg px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
                {group.roaster}
              </h3>
              <ul>
                {group.beans.map((bean) => (
                  <BeanRow key={bean.id} bean={bean} showRoaster={false} onPick={() => onPick(bean)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {extra.length > 0 && (
        <div>
          <h3 className="sticky top-14 z-10 bg-bg px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
            {local.length > 0 ? 'More matches' : 'Did you mean'}
          </h3>
          <ul>
            {extra.map((bean) => (
              <BeanRow key={bean.id} bean={bean} showRoaster onPick={() => onPick(bean)} />
            ))}
          </ul>
        </div>
      )}

      {typed.length >= 1 && nothing && !(needServer && search.isPending) && (
        <p className="px-3 py-3 text-sm text-muted">No beans match “{typed}”.</p>
      )}

      {typed.length >= 1 && (
        <div className="sticky -bottom-2 z-20 -mx-3 -mb-2 mt-auto border-t border-hairline bg-bg px-3 pt-2 pb-2">
          {known ? (
            <button
              type="button"
              onClick={() => onAddNew(known)}
              aria-label={
                known.name ? `Not here? Add “${known.name}” from ${known.roaster}` : `Add a new bean from ${known.roaster}`
              }
              className="flex h-11 w-full items-center justify-center rounded-full bg-accent-soft px-4 text-accent active:scale-[0.98]"
            >
              <span className="truncate">
                {known.name ? `Add “${known.name}” from ${known.roaster}` : `New bean from ${known.roaster}`}
              </span>
            </button>
          ) : (
            <div role="group" aria-label="Add as a new bean" className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate pl-2 text-sm text-muted">
                Add “<span className="text-ink">{typed}</span>” as
              </p>
              <button
                type="button"
                onClick={() => onAddNew({ roaster: typed })}
                className="h-11 shrink-0 rounded-full bg-accent-soft px-4 text-accent active:scale-[0.98]"
              >
                Roaster
              </button>
              <button
                type="button"
                onClick={() => onAddNew({ name: typed })}
                className="h-11 shrink-0 rounded-full bg-accent-soft px-4 text-accent active:scale-[0.98]"
              >
                Bean name
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
