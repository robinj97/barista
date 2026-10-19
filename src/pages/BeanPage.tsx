import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackLink } from '../components/BackLink'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { BeanHeader } from '../beans/BeanHeader'
import { BrewHistory } from '../beans/BrewHistory'
import { roastAge, toISODate } from '../beans/dates'
import { ROAST_LABELS, STATUS_LABELS } from '../beans/labels'
import { EditBagSheet } from '../beans/EditBagSheet'
import { stockOf, stockText, usualDoseG } from '../beans/stock'
import { useMyBags, useMyDrafts, useRemoveBag } from '../data/hooks'
import { LoadingNote } from '../components/LoadingNote'
import { SectionHeading } from '../components/SectionHeading'

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
  const [editing, setEditing] = useState(false)
  const drafts = useMyDrafts()
  const [today] = useState(() => toISODate(new Date()))

  const bag = bags.data?.find((item) => item.id === id)
  const back = <BackLink to="/beans" label="Back to beans" />

  if (bags.isPending) {
    return (
      <>
        {back}
        <LoadingNote />
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
  const roasted = roastAge(bag.roastDate)
  const stock = stockOf(bag, usualDoseG(bean.id, drafts.data))

  return (
    <>
      <BeanHeader beanId={bean.id} title={bean.name} subtitle={bean.roaster} back={back} />

      <section aria-label="About this coffee" className="mt-6">
        <SectionHeading>About this coffee</SectionHeading>
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
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-medium text-muted">Your bag</h2>
          <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-full px-3 text-sm text-accent">
            Edit
          </button>
        </div>
        <div className="squircle mt-2 rounded-4xl bg-soft p-2">
          <dl>
            <Fact label="Roasted" value={roasted ?? 'Date not set'} />
            <Fact label="Left in the bag" value={bag.gramsRemaining != null ? `${bag.gramsRemaining} g` : 'Not set'} />
            <Fact label="Status" value={bag.finishedAt ? 'Finished' : STATUS_LABELS[bag.status]} />
          </dl>
          {stock && <p className="px-3 pb-2 text-xs text-accent">{stockText(stock)}</p>}
        </div>
      </section>

      <section aria-label="Recipes" className="mt-6">
        <SectionHeading>Recipes</SectionHeading>
        <BrewHistory bag={bag} today={today} />
      </section>

      <Link
        to={`/brew?bag=${bag.id}`}
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

      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove this bag?"
        confirmLabel="Remove bag"
        onConfirm={() => {
          removeBag.mutate(bag.id)
          setConfirming(false)
          navigate('/beans')
        }}
      >
        {bean.name} leaves your beans. The coffee stays in the shared catalogue for everyone else.
      </ConfirmSheet>
      <EditBagSheet open={editing} onOpenChange={setEditing} bag={bag} />
    </>
  )
}
