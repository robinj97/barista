import { useState } from 'react'
import { Link } from 'react-router'
import { sampleBeans, type SampleStatus } from './sampleBeans'

type Filter = 'all' | SampleStatus

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dialing', label: 'Dialing in' },
  { value: 'locked', label: 'Locked' },
]

export function BeansPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const dialing = sampleBeans.find((bean) => bean.status === 'dialing')
  const visible = sampleBeans.filter((bean) => filter === 'all' || bean.status === filter)

  return (
    <>
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Beans</h1>
      <p className="mt-1 text-sm text-muted">Sample beans for layout only.</p>

      <div className="mt-5 flex gap-2" role="group" aria-label="Filter beans">
        {filters.map((item) => (
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

      {dialing && filter === 'all' && (
        <Link
          to={`/beans/${dialing.id}`}
          className="squircle mt-5 flex items-center gap-4 rounded-4xl bg-accent-soft p-4 transition-transform active:scale-[0.98]"
        >
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
            <circle cx="26" cy="26" r="21" fill="none" stroke="var(--bg)" strokeWidth="6" />
            <circle
              cx="26"
              cy="26"
              r="21"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="80 132"
              transform="rotate(-90 26 26)"
            />
          </svg>
          <span>
            <span className="block text-xs text-accent">Dialing in</span>
            <span className="block font-medium">{dialing.name}</span>
            <span className="block text-xs text-muted">One click finer next</span>
          </span>
        </Link>
      )}

      <ul className="mt-3 space-y-2.5">
        {visible.map((bean) => (
          <li key={bean.id}>
            <Link
              to={`/beans/${bean.id}`}
              className="squircle flex min-h-[4.5rem] items-center gap-4 rounded-4xl bg-soft py-3 pr-5 pl-3 transition-transform active:scale-[0.98]"
            >
              <span className={`size-[3.25rem] shrink-0 ${bean.tint} ${bean.pebble}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{bean.name}</span>
                <span className="block truncate text-xs text-muted">
                  {bean.roaster} · {bean.statusLabel}
                </span>
              </span>
              <span className="num text-xs text-muted">{bean.grams} g</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
