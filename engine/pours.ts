import type { Pour, Strength } from './types.ts'

/**
 * Parametric 4:6 pour structure (Tetsu Kasuya). Total water is split 40 / 60:
 * the first 40% in two pours sets sweetness against brightness, the last 60% in equal
 * pours sets strength. See docs/engine.md section 3 for the sources and where they disagree.
 */

/** Equal pours in the last 60%. More pours, stronger cup. */
export function laterPoursFor(strength: Strength): number {
  return { light: 2, medium: 3, strong: 4 }[strength]
}

/**
 * Pour start times in seconds. The first pour doubles as the bloom; later gaps follow the
 * 30 to 45 s pattern in the source recipes. Guidance only: pour again once the bed has mostly
 * drained.
 */
export function pourTimes(count: number, firstGapS = 45): number[] {
  const gaps = [firstGapS, 40, 40, 30]
  const times = [0]
  for (let i = 1; i < count; i++) times.push(times[i - 1]! + (gaps[i - 1] ?? 30))
  return times
}

/**
 * @param waterG total water
 * @param balance -1 sweeter ... +1 brighter (a bigger first pour is brighter)
 * @param laterPours equal pours in the last 60%
 */
export function buildPours(waterG: number, balance: number, laterPours: number, firstGapS = 45): Pour[] {
  const b = Math.min(1, Math.max(-1, balance))
  const phase1 = 0.4 * waterG
  const first = phase1 * (0.5 + b / 6)
  const share = (0.6 * waterG) / laterPours

  const cumulative = [first, phase1]
  for (let i = 1; i <= laterPours; i++) cumulative.push(phase1 + share * i)

  // Whole grams, strictly increasing, ending exactly on the total.
  const grams: number[] = []
  cumulative.forEach((value, i) => {
    const rounded = i === cumulative.length - 1 ? Math.round(waterG) : Math.round(value)
    grams.push(Math.max(rounded, (grams[i - 1] ?? 0) + 1))
  })

  const times = pourTimes(grams.length, firstGapS)
  return grams.map((toG, i) => ({ atS: times[i]!, toG }))
}

/** The inverse, for checking recipes people already brew: which balance and pour count made this? */
export function derivePourParams(pours: Pour[]): { balance: number; laterPours: number } {
  if (pours.length < 3) throw new Error('A 4:6 recipe needs at least three pours')
  const first = pours[0]!.toG
  const phase1 = pours[1]!.toG
  const raw = Math.min(1, Math.max(-1, (first / phase1 - 0.5) * 6))
  return { balance: Math.round(raw * 1000) / 1000, laterPours: pours.length - 2 }
}
