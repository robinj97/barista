import { buildPours, laterPoursFor } from '../../engine/pours.ts'
import type { Pour } from '../../engine/types.ts'
import type { BrewChoices, RecipeEdits } from './params'

/**
 * How an edit on the recipe screen changes the choices. The rules keep coffee, water and ratio
 * coherent: you edit one, the others follow in the way you would expect. `current` is the recipe
 * as it is shown right now, so "keep the ratio" keeps the ratio you can see.
 *
 *  - coffee, keep ratio (default): water follows. Coffee, keep water: the ratio changes.
 *  - water: your coffee stays, the ratio changes; or keep the ratio and the coffee is calculated.
 *  - ratio: your coffee stays, the water changes; or keep the water and the coffee is calculated.
 *  - custom pours always have the last word on water, so changing the water or ratio rescales them.
 */
export interface Shown {
  ratio: number
  waterG: number
}

const without = (edits: RecipeEdits, ...keys: (keyof RecipeEdits)[]): RecipeEdits => {
  const next = { ...edits }
  for (const key of keys) delete next[key]
  return next
}

const withEdits = (choices: BrewChoices, edits: RecipeEdits): BrewChoices => ({ ...choices, edits })

export function setDose(choices: BrewChoices, doseG: number, keep: 'ratio' | 'water', shown: Shown): BrewChoices {
  const { edits } = choices
  if (keep === 'water') return withEdits(choices, { ...without(edits, 'ratio'), doseG, waterG: shown.waterG })
  // Keep the ratio: with a water amount or custom pours in play, give the engine the new water to scale to.
  const needsWater = edits.waterG !== undefined || edits.pours !== undefined
  return withEdits(choices, { ...without(edits, 'waterG'), doseG, ...(needsWater ? { waterG: Math.round(doseG * shown.ratio) } : {}) })
}

/** Coffee that gives `waterG` at 1:`ratio`, to a tenth of a gram. */
export const doseFor = (waterG: number, ratio: number): number => Math.round((waterG / ratio) * 10) / 10

/** Water: by default your coffee stays and the ratio changes. Keeping the ratio instead calculates the coffee. */
export function setWater(choices: BrewChoices, waterG: number, keep: 'coffee' | 'ratio', shown: Shown): BrewChoices {
  const { edits } = choices
  if (keep === 'ratio') return withEdits(choices, { ...without(edits, 'ratio'), waterG, doseG: doseFor(waterG, shown.ratio) })
  return withEdits(choices, { ...without(edits, 'ratio'), waterG })
}

/** Ratio: by default your coffee stays and the water changes. Keeping the water instead calculates the coffee. */
export function setRatio(choices: BrewChoices, ratio: number, doseG: number, keep: 'coffee' | 'water', shown: Shown): BrewChoices {
  const { edits } = choices
  if (keep === 'water') return withEdits(choices, { ...without(edits, 'ratio'), waterG: shown.waterG, doseG: doseFor(shown.waterG, ratio) })
  // Custom pours cannot be told a ratio, only a water amount.
  if (edits.pours) return withEdits(choices, { ...without(edits, 'ratio'), waterG: Math.round(doseG * ratio) })
  return withEdits(choices, { ...without(edits, 'waterG'), ratio })
}

export function setTemp(choices: BrewChoices, tempC: number): BrewChoices {
  return withEdits(choices, { ...choices.edits, tempC })
}

export function setGrind(choices: BrewChoices, grindUm: number): BrewChoices {
  return withEdits(choices, { ...choices.edits, grindUm })
}

export function setTime(choices: BrewChoices, targetTimeS: number): BrewChoices {
  return withEdits(choices, { ...choices.edits, targetTimeS })
}

/**
 * Sweetness or strength. They only shape the pours, so every other edit (grind, temperature,
 * coffee, water, time) stays as it is. With your own pours the engine would ignore them, so the
 * pours are rebuilt for the new goal: same total water, your pour times kept, and when strength
 * adds a pour it comes one of your last gaps after the previous one.
 */
export function setGoal(choices: BrewChoices, patch: Partial<Pick<BrewChoices, 'balance' | 'strength'>>): BrewChoices {
  const next = { ...choices, ...patch }
  const custom = choices.edits.pours
  if (!custom || custom.length < 2) return next
  const last = custom.at(-1)!
  const lastGap = last.atS - custom.at(-2)!.atS
  const grams = buildPours(last.toG, next.balance, laterPoursFor(next.strength)).map((pour) => pour.toG)
  const pours = grams.map((toG, i) => ({ atS: custom[i]?.atS ?? last.atS + lastGap * (i - custom.length + 1), toG }))
  return withEdits(next, { ...choices.edits, pours })
}

/**
 * The choices for a bean as you left it: its working recipe (goal, size and every edit) on the bag
 * you picked. With no working recipe it starts from the suggestion, keeping your goal but not edits
 * that belonged to another bean.
 */
export function resumeChoices(bagId: string, working: BrewChoices | undefined, current: BrewChoices): BrewChoices {
  return working ? { ...working, bagId } : { ...current, bagId, edits: {} }
}

/** Your own pours decide the water, so a water amount or ratio set earlier is dropped. */
export function setPours(choices: BrewChoices, pours: Pour[]): BrewChoices {
  return withEdits(choices, { ...without(choices.edits, 'waterG', 'ratio'), pours })
}

/** Cups is a shortcut for the size: it clears your own dose, and water follows the ratio you see. */
export function setCups(choices: BrewChoices, cups: number, shown: Shown): BrewChoices {
  const { edits } = choices
  const needsWater = edits.waterG !== undefined || edits.pours !== undefined
  return {
    ...choices,
    cups,
    edits: { ...without(edits, 'doseG', 'waterG'), ...(needsWater ? { waterG: Math.round(cups * 10 * shown.ratio) } : {}) },
  }
}

/** Puts one value back to the suggestion. Resetting water or ratio puts the pair back together. */
export function resetEdit(choices: BrewChoices, ...keys: (keyof RecipeEdits)[]): BrewChoices {
  return withEdits(choices, without(choices.edits, ...keys))
}

export const clearEdits = (choices: BrewChoices): BrewChoices => withEdits(choices, {})

export const hasEdits = (choices: BrewChoices): boolean => Object.keys(choices.edits).length > 0
