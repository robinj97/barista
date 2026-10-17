import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Sheet } from '../components/Sheet'
import { beanCover } from '../beans/cover'
import { roastAge } from '../beans/dates'
import { ROAST_LABELS, STATUS_LABELS } from '../beans/labels'
import { useMyBags, useRemoveBag } from '../data/hooks'

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  )
}

export function BeanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const bags = useMyBags()
  const removeBag = useRemoveBag()
  const [confirming, setConfirming] = useState(false)

  const bag = bags.data?.find((item) => item.id === id)
  const back = (
    <Link to="/beans" aria-label="Back to beans" className="grid size-11 place-items-center rounded-full bg-soft text-lg">
      ←
    </Link>
  )

  if (bags.isPending) {
    return (
      <>
        {back}
        <p role="status" className="mt-10 text-center text-sm text-muted">
          Loading…
        </p>
      </>
    )
  }

  if (!bag) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-[2rem] leading-tight font-medium tracking-tight">Bag not found</h1>
        <p className="mt-2 text-sm text-muted">That bag isn't in your beans. It may have been removed.</p>
      </>
    )
  }

  const { bean } = bag
  const cover = beanCover(bean.id)
  const roasted = roastAge(bag.roastDate)

  return (
    <>
      <div className="flex items-center gap-3">
        {back}
        <span className={`size-12 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-medium">{bean.name}</h1>
          <p className="truncate text-xs text-muted">{bean.roaster}</p>
        </div>
      </div>

      <section aria-label="About this coffee" className="mt-6">
        <h2 className="px-2 text-xs font-medium text-muted">About this coffee</h2>
        <div className="squircle mt-2 rounded-4xl bg-soft p-2">
          <dl>
            <Fact label="Origin" value={bean.origin} />
            <Fact label="Region" value={bean.region} />
            <Fact label="Process" value={bean.process} />
            <Fact label="Roast level" value={bean.roastLevel ? ROAST_LABELS[bean.roastLevel] : null} />
            <Fact label="Variety" value={bean.variety} />
            <Fact label="Altitude" value={bean.altitudeM ? `${bean.altitudeM} m` : null} />
            <Fact label="Producer" value={bean.producer} />
          </dl>
          {bean.roasterNotes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-3 py-2" aria-label="Tasting notes">
              {bean.roasterNotes.map((note) => (
                <li key={note} className="rounded-full bg-bg px-3 py-1.5 text-xs">
                  {note}
                </li>
              ))}
            </ul>
          )}
          {!bean.origin && !bean.process && !bean.roastLevel && bean.roasterNotes.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">No details added yet.</p>
          )}
        </div>
      </section>

      <section aria-label="Your bag" className="mt-6">
        <h2 className="px-2 text-xs font-medium text-muted">Your bag</h2>
        <div className="squircle mt-2 rounded-4xl bg-soft p-2">
          <dl>
            <Fact label="Roasted" value={roasted ?? 'Date not set'} />
            <Fact label="Left in the bag" value={bag.gramsRemaining != null ? `${bag.gramsRemaining} g` : 'Not set'} />
            <Fact label="Status" value={STATUS_LABELS[bag.status]} />
          </dl>
        </div>
      </section>

      <section aria-label="Recipes" className="mt-6">
        <h2 className="px-2 text-xs font-medium text-muted">Recipes</h2>
        <p className="squircle mt-2 rounded-4xl bg-soft px-5 py-4 text-sm text-muted">
          No recipes yet. Start dialing in to get a first one.
        </p>
      </section>

      <Link
        to="/brew"
        className="mt-6 grid h-12 place-items-center rounded-full bg-ink font-medium text-bg transition-transform active:scale-[0.98]"
      >
        Start dialing in
      </Link>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-3 h-12 w-full rounded-full bg-soft text-muted active:scale-[0.98]"
      >
        Remove this bag
      </button>

      <Sheet open={confirming} onOpenChange={setConfirming} title="Remove this bag?">
        <div className="space-y-2 px-3 pb-2">
          <p className="px-2 text-sm text-muted">
            {bean.name} leaves your beans. The coffee stays in the shared catalogue for everyone else.
          </p>
          <button
            type="button"
            onClick={() => {
              removeBag.mutate(bag.id)
              setConfirming(false)
              navigate('/beans')
            }}
            className="h-12 w-full rounded-full bg-ink font-medium text-bg active:scale-[0.98]"
          >
            Remove bag
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-12 w-full rounded-full bg-soft active:scale-[0.98]">
            Keep it
          </button>
        </div>
      </Sheet>
    </>
  )
}
