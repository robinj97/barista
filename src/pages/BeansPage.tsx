import { useState } from 'react'
import { Link } from 'react-router'
import { AddBagSheet } from '../beans/AddBagSheet'
import { beanCover } from '../beans/cover'
import { EmptyBeans } from '../beans/EmptyBeans'
import { STATUS_LABELS } from '../beans/labels'
import { useMyBags } from '../data/hooks'
import type { BagStatus } from '../data/types'
import { PageHeader } from '../layout/PageHeader'

type Filter = 'all' | BagStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dialing_in', label: 'Dialing in' },
  { value: 'locked', label: 'Locked' },
]

export function BeansPage() {
  const bags = useMyBags()
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)

  const all = bags.data ?? []
  const visible = all.filter((bag) => filter === 'all' || bag.status === filter)

  return (
    <>
      <PageHeader title="Beans" />

      {bags.isPending && (
        <p role="status" className="mt-10 text-center text-sm text-muted">
          Loading your beans…
        </p>
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
          <div className="mt-5 flex gap-2" role="group" aria-label="Filter beans">
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
            <p className="mt-8 text-center text-sm text-muted">No beans here yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {visible.map((bag) => {
                const cover = beanCover(bag.bean.id)
                return (
                  <li key={bag.id}>
                    <Link
                      to={`/beans/${bag.id}`}
                      className="squircle flex min-h-[4.5rem] items-center gap-4 rounded-4xl bg-soft py-3 pr-5 pl-3 transition-transform active:scale-[0.98]"
                    >
                      <span className={`size-[3.25rem] shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{bag.bean.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {bag.bean.roaster} · {STATUS_LABELS[bag.status]}
                        </span>
                      </span>
                      {bag.gramsRemaining != null && <span className="num text-xs text-muted">{bag.gramsRemaining} g</span>}
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
