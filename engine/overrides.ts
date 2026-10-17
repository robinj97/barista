import { EngineError, type OverrideKey, type Overrides, type Pour } from './types.ts'

/** Limits for values a person types in. They guard against typos and bad URLs, not against odd-but-valid brews. */
export const LIMITS = {
  doseG: [5, 60],
  waterG: [30, 1500],
  ratio: [8, 30],
  tempC: [50, 100],
  grindUm: [100, 3000],
  targetTimeS: [30, 1800],
} as const

export const MAX_POURS = 12

function within(name: string, value: number, [lo, hi]: readonly [number, number]) {
  if (!Number.isFinite(value) || value < lo || value > hi) {
    throw new EngineError('invalid_input', `${name} must be between ${lo} and ${hi}`)
  }
}

export function validateDose(doseG: number) {
  within('Dose (g)', doseG, LIMITS.doseG)
}

/** Rejects values the types cannot rule out (they may come from a URL or storage). */
export function validateOverrides(o: Overrides | undefined): void {
  if (!o) return
  if (o.waterG !== undefined) within('Water (g)', o.waterG, LIMITS.waterG)
  if (o.ratio !== undefined) within('Ratio', o.ratio, LIMITS.ratio)
  if (o.tempC !== undefined) within('Temperature (°C)', o.tempC, LIMITS.tempC)
  if (o.grindUm !== undefined) within('Grind (µm)', o.grindUm, LIMITS.grindUm)
  if (o.targetTimeS !== undefined) within('Total time (s)', o.targetTimeS, LIMITS.targetTimeS)
  if (o.pours !== undefined) validatePours(o.pours)
}

function validatePours(pours: Pour[]) {
  if (pours.length < 1 || pours.length > MAX_POURS) {
    throw new EngineError('invalid_input', `Use between 1 and ${MAX_POURS} pours`)
  }
  if (pours[0]!.atS !== 0) throw new EngineError('invalid_input', 'The first pour starts at 0 s')
  pours.forEach((pour, i) => {
    if (!Number.isFinite(pour.atS) || !Number.isFinite(pour.toG) || pour.toG <= 0) {
      throw new EngineError('invalid_input', `Pour ${i + 1} needs a time and an amount`)
    }
    if (i > 0 && pour.atS <= pours[i - 1]!.atS) throw new EngineError('invalid_input', 'Pours must start in order')
    if (i > 0 && pour.toG <= pours[i - 1]!.toG) throw new EngineError('invalid_input', 'Each pour must add water')
  })
  within('Water (g)', pours.at(-1)!.toG, LIMITS.waterG)
}

/** The same pours (times unchanged) scaled so the last one ends exactly on `totalG`. */
export function scalePours(pours: Pour[], totalG: number): Pour[] {
  const factor = totalG / pours.at(-1)!.toG
  const scaled: Pour[] = []
  pours.forEach((pour, i) => {
    const last = i === pours.length - 1
    const grams = last ? Math.round(totalG) : Math.round(pour.toG * factor)
    scaled.push({ atS: pour.atS, toG: Math.max(grams, (scaled[i - 1]?.toG ?? 0) + 1) })
  })
  return scaled
}

/**
 * Which values came from the person. A water amount decides the ratio, so a ratio given alongside
 * it (or alongside custom pours) is ignored and not listed.
 */
export function overriddenKeys(doseSet: boolean, o: Overrides = {}): OverrideKey[] {
  const keys: OverrideKey[] = []
  if (doseSet) keys.push('doseG')
  if (o.waterG !== undefined) keys.push('waterG')
  if (o.ratio !== undefined && o.waterG === undefined && o.pours === undefined) keys.push('ratio')
  if (o.pours !== undefined) keys.push('pours')
  if (o.tempC !== undefined) keys.push('tempC')
  if (o.grindUm !== undefined) keys.push('grindUm')
  if (o.targetTimeS !== undefined) keys.push('targetTimeS')
  return keys
}
