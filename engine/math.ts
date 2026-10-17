/** Small numeric helpers shared across the engine. */

export type Range = [number, number]

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Rounds to the nearest multiple of `step` (0.5 for half degrees, 5 for microns). */
export const roundTo = (n: number, step: number) => Math.round(n / step) * step

/** Rounds to a number of decimal places without float noise in the result's digits. */
export const roundDp = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

export const sum = (values: number[]) => values.reduce((total, n) => total + n, 0)

export const mean = (values: number[]) => sum(values) / values.length

/** Mean of `[value, weight]` pairs. */
export const weightedMean = (pairs: [number, number][]) =>
  sum(pairs.map(([value, weight]) => value * weight)) / sum(pairs.map(([, weight]) => weight))

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** `value ± spread`. */
export const around = (value: number, spread: number): Range => [value - spread, value + spread]

/** The range, stretched if needed so it contains `value`. */
export const widenTo = ([lo, hi]: Range, value: number): Range => [Math.min(lo, value), Math.max(hi, value)]
