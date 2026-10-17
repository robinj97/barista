import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { micronsToSetting } from '../../engine/grinder.ts'
import { suggest } from '../../engine/suggest.ts'
import { formatTemp } from '../../engine/units.ts'
import type { Confidence } from '../../engine/grinder.ts'
import { beanCover } from '../beans/cover'
import { toISODate } from '../beans/dates'
import { buildSuggestInput, clock } from '../brew/buildInput'
import { goalOf, parseChoices, toSearchParams } from '../brew/params'
import { useBrewSelection } from '../brew/useBrewSelection'
import { WhySheet } from '../brew/WhySheet'
import { PourRing } from '../components/PourRing'
import { SegmentedControl } from '../components/SegmentedControl'
import { isCalibrated } from '../../engine/grinder.ts'
import { grinderName } from '../profile/gearLabels'

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  low: 'Starting point · expect 2–3 brews',
  medium: 'Informed by similar brews',
  high: 'Based on your own recipe',
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="squircle rounded-3xl bg-soft px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-0.5 text-base">{value}</dd>
    </div>
  )
}

/** The suggested recipe for the choices on the set-up screen. Nothing is saved yet. */
export function RecipePage() {
  const [params, setParams] = useSearchParams()
  const choices = parseChoices(params)
  const selection = useBrewSelection(choices)
  const [why, setWhy] = useState(false)
  // Fixed when the screen opens, so the recipe does not change under you at midnight.
  const [today] = useState(() => toISODate(new Date()))

  const back = (
    <Link to={{ pathname: '/brew', search: params.toString() }} aria-label="Back to set up" className="grid size-11 place-items-center rounded-full bg-soft text-lg">
      ←
    </Link>
  )

  if (selection.bags.isPending) {
    return (
      <>
        {back}
        <p role="status" className="mt-10 text-center text-sm text-muted">
          Loading…
        </p>
      </>
    )
  }

  const { bag } = selection
  if (!bag || selection.bagMissing) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-[2rem] leading-tight font-medium tracking-tight">Bean not found</h1>
        <p className="mt-2 text-sm text-muted">That bag isn't in your beans. Go back and pick another.</p>
      </>
    )
  }

  const unit = selection.profile.data?.temp_unit ?? 'c'
  const out = suggest(buildSuggestInput(bag, choices, selection.filter?.filter ?? null, today))
  const { recipe } = out
  const cover = beanCover(bag.bean.id)
  const goal = goalOf(choices.balance)
  const goalText = goal ?? 'custom balance'

  const myGrinder = selection.grinder
  const converted = myGrinder && isCalibrated(myGrinder.grinder) ? micronsToSetting(myGrinder.grinder, recipe.grindUm, myGrinder.offsetUm) : null

  const setCups = (cups: number) => setParams(toSearchParams({ ...choices, bagId: bag.id, cups }), { replace: true })

  return (
    <>
      <div className="flex items-center gap-3">
        {back}
        <span className={`size-12 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-medium">{bag.bean.name}</h1>
          <p className="truncate text-xs text-muted">
            V60 · {goalText}, {choices.strength}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setWhy(true)}
        className="mx-auto mt-5 flex h-9 items-center rounded-full bg-accent-soft px-4 text-sm text-accent"
      >
        {CONFIDENCE_TEXT[out.confidence.level]} ›
      </button>

      <div className="mt-4">
        <PourRing pours={recipe.pours} caption={`${recipe.pours.length} pours`} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2" aria-label="Recipe">
        <Spec label="Coffee" value={`${recipe.doseG} g`} />
        <Spec label="Water" value={`${recipe.waterG} g`} />
        <Spec label="Ratio" value={`1:${recipe.ratio}`} />
        <Spec label="Water temp" value={formatTemp(recipe.tempC, unit)} />
        <Spec label="Total time" value={`~${clock(recipe.targetTimeS)}`} />
        <Spec label="Filter" value={recipe.filter ? recipe.filter.model : 'None'} />
      </dl>

      <section aria-label="Grind" className="squircle mt-3 rounded-4xl bg-soft px-5 py-4">
        <p className="text-xs text-muted">Grind{myGrinder ? ` · ${grinderName(myGrinder.grinder)}` : ''}</p>
        {converted && myGrinder ? (
          <>
            <p className="num mt-1 text-2xl">
              {converted.setting} <span className="text-sm text-muted">{myGrinder.grinder.unitLabel}</span>
            </p>
            <p className="mt-1 text-xs text-muted">About {recipe.grindUm} µm</p>
            {converted.confidence === 'low' && (
              <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">Rough estimate</p>
            )}
            {converted.extrapolated && (
              <p className="mt-1 text-xs text-muted">This is outside the range we know for this grinder, so treat it as a guess.</p>
            )}
            {converted.clamped && <p className="mt-1 text-xs text-muted">That is at the limit of this grinder.</p>}
          </>
        ) : (
          <>
            <p className="num mt-1 text-2xl">
              {recipe.grindUm} <span className="text-sm text-muted">µm</span>
            </p>
            {myGrinder ? (
              <p className="mt-1 text-xs text-muted">We can't convert to {grinderName(myGrinder.grinder)} yet, so use the size as a guide.</p>
            ) : (
              <Link to="/profile" className="mt-2 inline-block text-sm text-accent underline">
                Add your grinder to see clicks
              </Link>
            )}
          </>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between px-2">
        <span className="text-sm text-muted">Cups</span>
        <SegmentedControl
          label="Cups"
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
          value={String(choices.cups)}
          onChange={(value) => setCups(Number(value))}
        />
      </div>

      <section aria-label="Pours" className="mt-4">
        <h2 className="px-2 text-xs font-medium text-muted">Pours</h2>
        <ol className="mt-2 space-y-1">
          {recipe.pours.map((pour, index) => (
            <li key={pour.atS} className="flex items-center gap-3 rounded-full py-2 pr-5 pl-2">
              <span className="grid size-8 place-items-center rounded-full bg-soft text-xs">{index + 1}</span>
              <span className="num flex-1 text-sm">{clock(pour.atS)}</span>
              <span className="num text-sm text-muted">+{pour.toG - (recipe.pours[index - 1]?.toG ?? 0)} g</span>
              <span className="num w-16 text-right text-sm">{pour.toG} g</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 px-2 text-xs text-muted">Pour again once the bed has mostly drained. Times are a guide, not a clock.</p>
      </section>

      <button type="button" onClick={() => setWhy(true)} className="mt-5 h-12 w-full rounded-full bg-soft active:scale-[0.98]">
        Why these numbers
      </button>

      <WhySheet open={why} onOpenChange={setWhy} basis={out.confidence.basis} reasons={out.reasons} />
    </>
  )
}
