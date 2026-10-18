import { Link } from 'react-router'
import type { TempUnit } from '../../engine/units.ts'
import { formatDMY, toISODate } from '../beans/dates'
import { grindText } from '../brew/feedback'
import { recipeText } from '../brew/format'
import { PourList } from '../brew/PourList'
import { Spec, SpecGrid } from '../components/Spec'
import { Sheet } from '../components/Sheet'
import type { FriendRecipe, MyGrinder } from '../data/types'
import { buttonClass } from '../components/buttonStyle'

interface FriendRecipeSheetProps {
  recipe: FriendRecipe | null
  onClose: () => void
  unit: TempUnit
  grinder: MyGrinder | undefined
  /** Where "Brew this" goes, when you have a bag of the bean. */
  brewTo: string | null
}

/** A friend's locked recipe in full. Tapping one always opens this; brewing from it needs a bag of the bean. */
export function FriendRecipeSheet({ recipe, onClose, unit, grinder, brewTo }: FriendRecipeSheetProps) {
  const numbers = recipe?.snapshot.recipe
  const text = numbers ? recipeText(numbers, unit) : null
  return (
    <Sheet open={recipe !== null} onOpenChange={(open) => !open && onClose()} title={recipe ? `${recipe.bean.name}` : 'Recipe'}>
      {recipe && numbers && text && (
        <div className="px-3 pb-3">
          <p className="px-1 text-sm text-muted">
            {recipe.friend.name}'s recipe · {recipe.bean.roaster} · locked {formatDMY(toISODate(new Date(recipe.lockedAt)))}
          </p>
          <SpecGrid label="Their recipe" className="mt-3">
            <Spec label="Coffee" value={text.coffee} />
            <Spec label="Water" value={text.water} />
            <Spec label="Ratio" value={text.ratio} />
            <Spec label="Water temp" value={text.temp} />
            <Spec label="Total time" value={text.time} />
            <Spec label="Grind" value={grindText(numbers.grindUm, grinder)} />
          </SpecGrid>
          <PourList pours={numbers.pours} label="Their pours" amounts className="mt-3" />
          {brewTo ? (
            <Link to={brewTo} onClick={onClose} className={`mt-4 ${buttonClass(undefined, true)}`}>
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
