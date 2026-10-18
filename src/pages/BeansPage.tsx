import { useState } from 'react'
import { Link } from 'react-router'
import { AddBagSheet } from '../beans/AddBagSheet'
import { eyebrow, matchesSearch, visibleNotes } from '../beans/cardText'
import { beanCover } from '../beans/cover'
import { EmptyBeans } from '../beans/EmptyBeans'
import { STATUS_LABELS } from '../beans/labels'
import { stockOf, stockText, usualDoseG } from '../beans/stock'
import { useMyBags, useMyDrafts } from '../data/hooks'
import type { BagStatus } from '../data/types'
import { InstallPrompt } from '../install/InstallPrompt'
import { PageHeader } from '../layout/PageHeader'
import { LoadingNote } from '../components/LoadingNote'

type Filter = 'all' | BagStatus | 'finished'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dialing_in', label: 'Dialing in' },
  { value: 'locked', label: 'Locked' },
  { value: 'finished', label: 'Finished' },
]

export function BeansPage() {
  const bags = useMyBags()
  const drafts = useMyDrafts()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const all = bags.data ?? []
  // Finished bags stay out of the way: they have their own filter and are not in All.
  const inFilter = (bag: (typeof all)[number]) =>
    filter === 'finished' ? !!bag.finishedAt : !bag.finishedAt && (filter === 'all' || bag.status === filter)
  const visible = all.filter((bag) => inFilter(bag) && matchesSearch(bag, search))
  const searching = search.trim().length > 0
  const lowStock = (bag: (typeof all)[number]) => {
    const stock = stockOf(bag, usualDoseG(bag.bean.id, drafts.data))
    return stock ? stockText(stock) : null
  }

  return (
    <>
      <PageHeader title="Beans" />

      <InstallPrompt />

      {bags.isPending && (
        <LoadingNote>Loading your beans…</LoadingNote>
      )}

      {bags.isError && (
        <p role="alert" className="mt-10 text-center text-sm text-accent">
          Couldn't load your beans.{' '}
          <button type="button" onClick={() => void bags.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}

      {bags.isSuccess && all.length === 0 && <EmptyBeans onAdd={() => setAdding(true)} />}

      {bags.isSuccess && all.length > 0 && (
        <>
          <label className="mt-5 block">
            <span className="sr-only">Search your beans</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, variety, process or notes"
              enterKeyHint="search"
              className="h-11 w-full rounded-full bg-soft px-5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>

          <div className="mt-3 flex gap-2" role="group" aria-label="Filter beans">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`h-10 rounded-full px-4 text-sm transition-colors duration-200 ${
                  filter === item.value ? 'bg-ink text-bg' : 'bg-soft text-muted'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted">
              {searching ? (
                <>
                  No beans match “{search.trim()}”.{' '}
                  <button type="button" onClick={() => setSearch('')} className="underline">
                    Clear search
                  </button>
                </>
              ) : (
                'No beans here yet.'
              )}
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {visible.map((bag) => {
                const { bean } = bag
                const cover = beanCover(bean.id)
                const line = eyebrow(bean)
                const notes = visibleNotes(bean.roasterNotes)
                return (
                  <li key={bag.id}>
                    <Link
                      to={`/beans/${bag.id}`}
                      className="squircle flex items-start gap-4 rounded-4xl bg-soft py-3.5 pr-5 pl-3.5 transition-transform active:scale-[0.98]"
                    >
                      <span className={`mt-0.5 size-[3.25rem] shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        {line && <span className="block truncate text-xs font-medium text-accent">{line}</span>}
                        <span className="block truncate font-medium">{bean.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {bean.roaster} · {bag.finishedAt ? 'Finished' : STATUS_LABELS[bag.status]}
                        </span>
                        {lowStock(bag) && <span className="block truncate text-xs text-accent">{lowStock(bag)}</span>}
                        {notes.shown.length > 0 && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {notes.shown.map((note) => (
                              <span key={note} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
                                {note}
                              </span>
                            ))}
                            {notes.extra > 0 && (
                              <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted">+{notes.extra}</span>
                            )}
                          </span>
                        )}
                      </span>
                      {bag.gramsRemaining != null && (
                        <span className="num mt-1 text-xs text-muted">{bag.gramsRemaining} g</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            aria-label="Add a bag"
            onClick={() => setAdding(true)}
            className="pebble-2 fixed right-5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center bg-ink text-bg transition-transform active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </>
      )}

      <AddBagSheet open={adding} onOpenChange={setAdding} />
    </>
  )
}
