import { Button } from '../components/Button'
import { Spec, SpecGrid } from '../components/Spec'
import type { EditField } from './EditSheets'
import { GrindCard } from './GrindCard'
import type { RecipeModel } from './model'
import { SizeControls } from './SizeControls'

interface RecipeViewProps {
  model: RecipeModel
  onEdit: (field: EditField) => void
  onStart: () => void
}

/** The recipe's numbers, each tappable to edit, the grind, how much to make, and the way to start. */
export function RecipeView({ model, onEdit, onStart }: RecipeViewProps) {
  const { text, recipe, isOverridden } = model
  return (
    <>
      <SpecGrid label="Recipe">
        <Spec label="Coffee" value={text.coffee} edited={isOverridden('doseG')} onEdit={() => onEdit('dose')} />
        <Spec label="Water" value={text.water} edited={isOverridden('waterG') || isOverridden('pours')} onEdit={() => onEdit('water')} />
        <Spec label="Ratio" value={text.ratio} edited={isOverridden('ratio')} onEdit={() => onEdit('ratio')} />
        <Spec label="Water temp" value={text.temp} edited={isOverridden('tempC')} onEdit={() => onEdit('temp')} />
        <Spec label="Total time" value={text.time} edited={isOverridden('targetTimeS')} onEdit={() => onEdit('time')} />
        <Spec label="Filter" value={recipe.filter ? recipe.filter.model : 'None'} />
      </SpecGrid>
      <GrindCard model={model} onEdit={() => onEdit('grind')} />
      <SizeControls model={model} />
      <Button onClick={onStart} className="mt-5">
        Start brewing
      </Button>
    </>
  )
}
