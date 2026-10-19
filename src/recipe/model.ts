import { isCalibrated, micronsToSetting, type SettingResult } from '../../engine/grinder.ts'
import type { SuggestOutput } from '../../engine/types.ts'
import type { TempUnit } from '../../engine/units.ts'
import { recipeText } from '../brew/format'
import type { BrewChoices, RecipeEdits } from '../brew/params'
import type { Bag, MyFilter, MyGrinder, RecipeNumbers } from '../data/types'

/**
 * Everything the recipe screen's parts need to know about the recipe on screen, worked out once:
 * the choices and how to change them, the engine's answer, and the grind in the person's grinder.
 * Parts take this instead of a long list of props, and none of them recalculates anything.
 */
export interface RecipeModel {
  bag: Bag
  choices: BrewChoices
  /** Changes the choices, which changes the recipe (they live in the page address). */
  apply: (next: BrewChoices) => void
  out: SuggestOutput
  recipe: SuggestOutput['recipe']
  text: ReturnType<typeof recipeText>
  unit: TempUnit
  grinder: MyGrinder | undefined
  /** The filter chosen for this brew, or null for none. */
  filter: MyFilter | null
  /** The grind in your grinder's own units, or null with no usable grinder. */
  converted: SettingResult | null
  /** The ratio and water as they are right now: what "keep the ratio" keeps. */
  shown: { ratio: number; waterG: number }
  /** Whether you set any of these by hand (they are in the address). */
  has: (...keys: (keyof RecipeEdits)[]) => boolean
  /** Whether the engine used a value you set, for the dot on a card. */
  isOverridden: (key: SuggestOutput['overridden'][number]) => boolean
  /** The recipe the engine would make from other choices, for working out a change before it's applied. */
  recompute: (next: BrewChoices) => RecipeNumbers
}

interface ModelInput {
  bag: Bag
  choices: BrewChoices
  out: SuggestOutput
  unit: TempUnit
  grinder: MyGrinder | undefined
  filter: MyFilter | null
  apply: (next: BrewChoices) => void
  recompute: (next: BrewChoices) => RecipeNumbers
}

export function buildRecipeModel({ bag, choices, out, unit, grinder, filter, apply, recompute }: ModelInput): RecipeModel {
  const { recipe } = out
  return {
    bag,
    choices,
    apply,
    out,
    recipe,
    text: recipeText(recipe, unit),
    unit,
    grinder,
    filter,
    converted: grinder && isCalibrated(grinder.grinder) ? micronsToSetting(grinder.grinder, recipe.grindUm, grinder.offsetUm) : null,
    shown: { ratio: recipe.waterG / recipe.doseG, waterG: recipe.waterG },
    has: (...keys) => keys.some((key) => key in choices.edits),
    isOverridden: (key) => out.overridden.includes(key),
    recompute,
  }
}
