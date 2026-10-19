import { formatTemp, type TempUnit } from '../../engine/units.ts'
import type { RecipeNumbers } from '../data/types'
import { clock } from './buildInput'

type Numbers = Pick<RecipeNumbers, 'doseG' | 'waterG' | 'ratio' | 'tempC' | 'targetTimeS'>

/** A recipe's numbers as the text shown for them, in the person's temperature unit. One place, so every screen agrees. */
export function recipeText(numbers: Numbers, unit: TempUnit) {
  return {
    coffee: `${numbers.doseG} g`,
    water: `${numbers.waterG} g`,
    ratio: `1:${numbers.ratio}`,
    temp: formatTemp(numbers.tempC, unit),
    time: `~${clock(numbers.targetTimeS)}`,
  }
}

/** "20 g · 300 g · 94°C", optionally with the grind. For a row in a list. */
export function recipeSummary(numbers: Pick<RecipeNumbers, 'doseG' | 'waterG' | 'tempC'>, unit: TempUnit, grind?: string): string {
  return [`${numbers.doseG} g`, `${numbers.waterG} g`, formatTemp(numbers.tempC, unit), grind].filter(Boolean).join(' · ')
}
