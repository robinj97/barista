import { clamp, roundDp } from './math.ts'
import { EngineError, type Pour, type Strength } from './types.ts'

/**
 * Parametric 4:6 pour structure (Tetsu Kasuya). Total water is split 40 / 60:
 * the first 40% in two pours sets sweetness against brightness, the last 60% in equal
 * pours sets strength. See docs/engine.md section 3 for the sources and where they disagree.
 */

/** Seconds between the first pour (the bloom) and the second. */
export const BLOOM_GAP_S = 45
/** Gaps between the later pours, following the 30 to 45 s pattern in the source recipes. */
const LATER_GAPS_S = [40, 40, 30]
const LAST_GAP_S = 30

/** Equal pours in the last 60%. More pours, stronger cup. */
const LATER_POURS: Record<Strength, number> = { light: 2, medium: 3, strong: 4 }

export const laterPoursFor = (strength: Strength): number => LATER_POURS[strength]

/** Pour start times in seconds. Guidance only: pour again once the bed has mostly drained. */
export function pourTimes(count: number, bloomGapS = BLOOM_GAP_S): number[] {
  const gaps = [bloomGapS, ...LATER_GAPS_S]
  const times = [0]
  for (let i = 1; i < count; i++) times.push(times[i - 1]! + (gaps[i - 1] ?? LAST_GAP_S))
  return times
}

/**
 * @param waterG total water
 * @param balance -1 sweeter ... +1 brighter (a bigger first pour is brighter)
 * @param laterPours equal pours in the last 60%
 */
export function buildPours(waterG: number, balance: number, laterPours: number, bloomGapS = BLOOM_GAP_S): Pour[] {
  const phase1 = 0.4 * waterG
  const first = phase1 * (0.5 + clamp(balance, -1, 1) / 6)
  const share = (0.6 * waterG) / laterPours
  const cumulative = [first, phase1, ...Array.from({ length: laterPours }, (_, i) => phase1 + share * (i + 1))]

  // Whole grams, strictly increasing, ending exactly on the total.
  const grams: number[] = []
  cumulative.forEach((value, i) => {
    const rounded = i === cumulative.length - 1 ? Math.round(waterG) : Math.round(value)
    grams.push(Math.max(rounded, (grams[i - 1] ?? 0) + 1))
  })

  const times = pourTimes(grams.length, bloomGapS)
  return grams.map((toG, i) => ({ atS: times[i]!, toG }))
}

/** The inverse, for checking recipes people already brew: which balance and pour count made this? */
export function derivePourParams(pours: Pour[]): { balance: number; laterPours: number } {
  if (pours.length < 3) throw new EngineError('invalid_input', 'A 4:6 recipe needs at least three pours')
  const balance = clamp((pours[0]!.toG / pours[1]!.toG - 0.5) * 6, -1, 1)
  return { balance: roundDp(balance, 3), laterPours: pours.length - 2 }
}
