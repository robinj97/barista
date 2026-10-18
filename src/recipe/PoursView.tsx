import { Button } from '../components/Button'
import { SectionHeading } from '../components/SectionHeading'
import { PourList } from '../brew/PourList'
import type { RecipeModel } from './model'

interface PoursViewProps {
  model: RecipeModel
  onEditPours: () => void
  onStartTimer: () => void
  onFinishUntimed: () => void
}

/** The pour schedule before a brew, with the two ways to go: start the timer, or finish without one. */
export function PoursView({ model, onEditPours, onStartTimer, onFinishUntimed }: PoursViewProps) {
  return (
    <section aria-label="Pours" className="mt-4">
      <div className="flex items-center justify-between px-2">
        <SectionHeading>Pours{model.isOverridden('pours') ? ' · yours' : ''}</SectionHeading>
        <button type="button" onClick={onEditPours} className="h-9 rounded-full px-3 text-sm text-accent">
          Edit pours
        </button>
      </div>
      <PourList pours={model.recipe.pours} amounts className="mt-2" />
      <p className="mt-2 px-2 text-xs text-muted">Times are a guide, not a clock.</p>
      <div className="mt-4 space-y-3">
        <Button onClick={onStartTimer} size="xl">
          Start timer
        </Button>
        <Button onClick={onFinishUntimed} size="xl">
          Finished brewing
        </Button>
      </div>
    </section>
  )
}
