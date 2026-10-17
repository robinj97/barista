import { useBeanSearch } from '../data/hooks'
import type { BeanMatch } from '../data/types'
import { beanCover } from './cover'
import { useDebouncedValue } from './useDebouncedValue'

interface SearchStepProps {
  query: string
  onQueryChange: (query: string) => void
  onPick: (bean: BeanMatch) => void
  onAddNew: (typed: string) => void
}

function describe(bean: BeanMatch): string {
  return [bean.roaster, bean.origin, bean.process].filter(Boolean).join(' · ')
}

export function SearchStep({ query, onQueryChange, onPick, onAddNew }: SearchStepProps) {
  const debounced = useDebouncedValue(query)
  const search = useBeanSearch(debounced)
  const typed = query.trim()
  const results = typed.length >= 2 ? (search.data ?? []) : []

  return (
    <div className="space-y-2 px-3 pb-2">
      <label className="block">
        <span className="sr-only">Search roaster or bean</span>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search roaster or bean"
          enterKeyHint="search"
          className="h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      {typed.length < 2 && (
        <p className="px-3 py-3 text-sm text-muted">Start typing a roaster or bean name. Most coffees are already here.</p>
      )}

      {typed.length >= 2 && search.isError && (
        <p role="alert" className="px-3 py-3 text-sm text-accent">
          Couldn't search just now. You can still add it yourself below.
        </p>
      )}

      {typed.length >= 2 && search.isPending && !search.isError && (
        <p className="px-3 py-3 text-sm text-muted" role="status">
          Searching…
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1" aria-label="Matching beans">
          {results.map((bean) => {
            const cover = beanCover(bean.id)
            return (
              <li key={bean.id}>
                <button
                  type="button"
                  onClick={() => onPick(bean)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-3xl px-3 py-2 text-left active:bg-soft"
                >
                  <span className={`size-11 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{bean.name}</span>
                    <span className="block truncate text-xs text-muted">{describe(bean)}</span>
                    {bean.owned && (
                      <span className="mt-1 inline-block rounded-full bg-soft px-2.5 py-0.5 text-xs text-muted">
                        In your beans
                      </span>
                    )}
                    {bean.friendsWithRecipe > 0 && (
                      <span className="mt-1 ml-1 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
                        {bean.friendsWithRecipe === 1
                          ? 'A friend has this dialed in'
                          : `${bean.friendsWithRecipe} friends have this dialed in`}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {typed.length >= 2 && !search.isPending && results.length === 0 && !search.isError && (
        <p className="px-3 py-2 text-sm text-muted">No matches for “{typed}”.</p>
      )}

      {typed.length >= 1 && (
        <button
          type="button"
          onClick={() => onAddNew(typed)}
          className="h-12 w-full rounded-full border border-dashed border-muted text-accent active:scale-[0.98]"
        >
          Not here? Add “{typed}” as a new bean
        </button>
      )}
    </div>
  )
}
