import { Link } from 'react-router'
import { formatTemp, type TempUnit } from '../../engine/units.ts'
import { formatDMY, toISODate } from '../beans/dates'
import { clock } from '../brew/buildInput'
import { grindText } from '../brew/feedback'
import { Sheet } from '../components/Sheet'
import type { FriendRecipe, MyGrinder } from '../data/types'

interface FriendRecipeSheetProps {
  recipe: FriendRecipe | null
  onClose: () => void
  unit: TempUnit
  grinder: MyGrinder | undefined
  /** Where "Brew this" goes, when you have a bag of the bean. */
  brewTo: string | null
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="squircle rounded-3xl bg-soft px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-0.5 text-base">{value}</dd>
    </div>
  )
}

/** A friend's locked recipe in full. Tapping one always opens this; brewing from it needs a bag of the bean. */
export function FriendRecipeSheet({ recipe, onClose, unit, grinder, brewTo }: FriendRecipeSheetProps) {
  const numbers = recipe?.snapshot.recipe
  return (
    <Sheet open={recipe !== null} onOpenChange={(open) => !open && onClose()} title={recipe ? `${recipe.bean.name}` : 'Recipe'}>
      {recipe && numbers && (
        <div className="px-3 pb-3">
          <p className="px-1 text-sm text-muted">
            {recipe.friend.name}'s recipe · {recipe.bean.roaster} · locked {formatDMY(toISODate(new Date(recipe.lockedAt)))}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2" aria-label="Their recipe">
            <Spec label="Coffee" value={`${numbers.doseG} g`} />
            <Spec label="Water" value={`${numbers.waterG} g`} />
            <Spec label="Ratio" value={`1:${numbers.ratio}`} />
            <Spec label="Water temp" value={formatTemp(numbers.tempC, unit)} />
            <Spec label="Total time" value={`~${clock(numbers.targetTimeS)}`} />
            <Spec label="Grind" value={grindText(numbers.grindUm, grinder)} />
          </dl>
          <ol className="mt-3 space-y-1" aria-label="Their pours">
            {numbers.pours.map((pour, index) => (
              <li key={pour.atS} className="flex items-center gap-3 rounded-full py-1.5 pr-5 pl-2">
                <span className="grid size-7 place-items-center rounded-full bg-soft text-xs">{index + 1}</span>
                <span className="num flex-1 text-sm">{clock(pour.atS)}</span>
                <span className="num text-sm text-muted">+{pour.toG - (numbers.pours[index - 1]?.toG ?? 0)} g</span>
                <span className="num w-16 text-right text-sm">{pour.toG} g</span>
              </li>
            ))}
          </ol>
          {brewTo ? (
            <Link to={brewTo} onClick={onClose} className="mt-4 grid h-12 w-full place-items-center rounded-full bg-ink font-medium text-bg">
              Brew this
            </Link>
          ) : (
            <p className="mt-4 rounded-3xl bg-accent-soft px-4 py-3 text-sm text-accent">
              You don't have this bean yet. Add it from the Beans tab, and you can brew from these numbers.
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
