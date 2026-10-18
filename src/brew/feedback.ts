import { isCalibrated, micronsToSetting } from '../../engine/grinder.ts'
import { formatTemp, type TempUnit } from '../../engine/units.ts'
import { IMPROVE_LABELS, TASTE_LABELS, tastesOf, type BrewResult, type Change, type MyGrinder, type RecipeNumbers } from '../data/types'

/**
 * Toggles a chip where one of them ("Good", "Nothing") means none of the others: picking it clears
 * the rest, and picking any other chip clears it.
 */
export function toggleExclusive<T extends string>(list: T[], value: T, exclusive: T): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value)
  return value === exclusive ? [exclusive] : [...list.filter((v) => v !== exclusive), value]
}

const MIN_STEP: Record<Change['param'], number> = { dose: 0.1, water: 1, ratio: 0.1, temp: 0.5, grind: 5 }

/** What is different between two brews of the same bean. Tiny differences (rounding) are ignored. */
export function diffRecipes(before: RecipeNumbers, after: RecipeNumbers): Change[] {
  const pairs: [Change['param'], number, number][] = [
    ['dose', before.doseG, after.doseG],
    ['water', before.waterG, after.waterG],
    ['ratio', before.ratio, after.ratio],
    ['temp', before.tempC, after.tempC],
    ['grind', before.grindUm, after.grindUm],
  ]
  return pairs.filter(([param, from, to]) => Math.abs(to - from) >= MIN_STEP[param]).map(([param, from, to]) => ({ param, from, to }))
}

/** "Temp 95 → 93°C", "Grind finer". The grind is described by direction because its number depends on the grinder. */
export function describeChange(change: Change, unit: TempUnit): string {
  switch (change.param) {
    case 'dose':
      return `Coffee ${change.from} → ${change.to} g`
    case 'water':
      return `Water ${change.from} → ${change.to} g`
    case 'ratio':
      return `Ratio 1:${change.from} → 1:${change.to}`
    case 'temp':
      return `Temp ${formatTemp(change.from, unit).replace(/°[CF]$/, '')} → ${formatTemp(change.to, unit)}`
    case 'grind':
      return change.to < change.from ? 'Grind finer' : 'Grind coarser'
  }
}

const sentence = (labels: string[]) => labels.map((label, i) => (i === 0 ? label : label.toLowerCase())).join(', ')

/** Everything a brew log has to say, in words. Empty when the log was skipped. */
export function lastBrewLines(brew: BrewResult) {
  const tastes = tastesOf(brew).map((t) => TASTE_LABELS[t])
  const improve = (brew.improve ?? []).map((i) => IMPROVE_LABELS[i])
  return {
    tasted: tastes.length ? sentence(tastes) : null,
    wanted: improve.length ? sentence(improve) : null,
    note: brew.notes.trim() || null,
  }
}

/** The grind in your grinder's units (or microns), for the settings line. */
export function grindText(grindUm: number, grinder: MyGrinder | undefined): string {
  if (grinder && isCalibrated(grinder.grinder)) {
    const { setting } = micronsToSetting(grinder.grinder, grindUm, grinder.offsetUm)
    return `${setting} ${grinder.grinder.unitLabel}`
  }
  return `${grindUm} µm`
}

