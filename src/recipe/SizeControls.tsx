import { LIMITS } from '../../engine/overrides.ts'
import { setCups, setDose } from '../brew/edits'
import { SegmentedControl } from '../components/SegmentedControl'
import type { RecipeModel } from './model'

/** How much to make: cups as a shortcut, and the coffee in grams a step at a time. */
export function SizeControls({ model }: { model: RecipeModel }) {
  const { choices, recipe, shown, apply, isOverridden } = model
  const nudgeDose = (direction: 1 | -1) => {
    const doseG = Math.min(LIMITS.doseG[1], Math.max(LIMITS.doseG[0], recipe.doseG + direction))
    apply(setDose(choices, doseG, 'ratio', shown))
  }
  return (
    <>
      <div className="mt-4 flex items-center justify-between px-2">
        <span className="text-sm text-muted">Cups</span>
        <SegmentedControl
          label="Cups"
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
          value={isOverridden('doseG') ? '' : String(choices.cups)}
          onChange={(value) => apply(setCups(choices, Number(value), shown))}
        />
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
        <span className="text-sm text-muted">Coffee</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Less coffee" onClick={() => nudgeDose(-1)} className="size-10 rounded-full bg-soft active:scale-95">
            −
          </button>
          <span className="num min-w-[4.5rem] text-center whitespace-nowrap">{recipe.doseG} g</span>
          <button type="button" aria-label="More coffee" onClick={() => nudgeDose(1)} className="size-10 rounded-full bg-soft active:scale-95">
            +
          </button>
        </div>
      </div>
    </>
  )
}
