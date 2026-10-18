import type { TempUnit } from '../../engine/units.ts'
import { formatDMY, toISODate } from '../beans/dates'
import type { BrewResult, MyGrinder } from '../data/types'
import { describeChange, grindText, lastBrewLines } from './feedback'
import { recipeSummary } from './format'

interface LastBrewCardProps {
  brew: BrewResult
  unit: TempUnit
  grinder: MyGrinder | undefined
}

/** A reminder at the top of the recipe: how the last brew of this bean went and what you wanted to change. */
export function LastBrewCard({ brew, unit, grinder }: LastBrewCardProps) {
  const { tasted, wanted, note } = lastBrewLines(brew)
  if (!tasted && !wanted && !note) return null
  const { recipe } = brew
  return (
    <section aria-label="Last brew" className="squircle mt-4 rounded-4xl bg-soft px-5 py-4">
      <h2 className="text-xs font-medium text-muted">Last brew · {formatDMY(toISODate(new Date(brew.brewedAt)))}</h2>
      {tasted && (
        <p className="mt-2 text-sm">
          <span className="text-muted">It was </span>
          {tasted.toLowerCase()}
        </p>
      )}
      {wanted && (
        <p className="mt-1 text-sm">
          <span className="text-muted">You wanted </span>
          {wanted.toLowerCase()}
        </p>
      )}
      {note && <p className="mt-2 text-sm italic text-muted">“{note}”</p>}
      {recipe && (
        <p className="num mt-3 text-xs text-muted">
          {recipeSummary(recipe, unit, grindText(recipe.grindUm, grinder))}
        </p>
      )}
      {brew.changes && brew.changes.length > 0 && (
        <p className="mt-1 text-xs text-muted">Changed from the brew before: {brew.changes.map((c) => describeChange(c, unit)).join(' · ')}</p>
      )}
    </section>
  )
}
