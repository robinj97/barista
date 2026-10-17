import { bloomGap, grindPrior, ratioPrior, targetTime, tempPrior, type Estimate } from './priors.ts'
import { buildPours, laterPoursFor } from './pours.ts'
import { noteNudge } from './notes.ts'
import { nearestPriors } from './similarity.ts'
import {
  EngineError,
  type ConfidenceLevel,
  type Method,
  type PriorRecipe,
  type Reason,
  type SuggestInput,
  type SuggestOutput,
} from './types.ts'

/** Methods the engine can suggest for. AeroPress and espresso need their own research first. */
export function supportsMethod(method: Method): boolean {
  return method === 'v60'
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const half = (n: number) => Math.round(n * 2) / 2
const round5 = (n: number) => Math.round(n / 5) * 5

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function describeCount(n: number, singular: string, plural: string) {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`
}

/**
 * Suggest a starting V60 recipe for a bean and a target flavour, with the reason for every
 * decision and an honest confidence. Pure and deterministic: the same input always gives the
 * same output. See docs/engine.md.
 */
export function suggest(input: SuggestInput): SuggestOutput {
  if (!supportsMethod(input.method)) {
    throw new EngineError('unsupported_method', `No suggestions for ${input.method} yet`)
  }
  const doseG = input.doseG ?? 10 * input.cups
  if (!Number.isFinite(doseG) || doseG < 5 || doseG > 60) {
    throw new EngineError('invalid_input', 'Dose must be between 5 and 60 g')
  }

  const reasons: Reason[] = []

  // 1. The dials: balance (with the notes' nudge) and strength.
  const requested = clamp(input.target.balance, -1, 1)
  const { nudge, bright, sweet } = noteNudge(input.target.emphasise)
  const balance = clamp(requested + nudge, -1, 1)
  const laterPours = laterPoursFor(input.target.strength)
  const { gapS, reason: bloomReason } = bloomGap(input.bean.roastDate, input.asOf)

  // 2. Centres for temperature and grind: guidance, then data.
  const temp: Estimate = tempPrior(input.bean)
  const grind: Estimate = grindPrior(input.bean, input.filter)
  const ratio: Estimate = ratioPrior(input.target.strength)

  const own = (input.context?.own ?? []).filter((p) => p.method === input.method)
  const friends = (input.context?.friends ?? []).filter((p) => p.method === input.method)
  const sameBean = (prior: PriorRecipe) => !!input.bean.id && prior.beanId === input.bean.id
  const ownSame = own.filter(sameBean)
  const friendSame = friends.filter(sameBean)

  let tempC = temp.value
  let tempRange = temp.range
  let grindUm = grind.value
  let grindRange = grind.range
  let level: ConfidenceLevel = 'low'
  let basis = 'Based on the 4:6 method and general brewing guidance. No recipes for this bean or similar ones yet, so expect two or three brews to dial it in.'
  const dataReasons: Reason[] = []

  if (ownSame.length > 0 || friendSame.length > 0) {
    const mine = ownSame.length > 0
    const pool = mine ? ownSame : friendSame
    tempC = half(median(pool.map((p) => p.tempC)))
    grindUm = round5(median(pool.map((p) => p.grindUm)))
    tempRange = mine ? [tempC - 1, tempC + 1] : [tempC - 1.5, tempC + 1.5]
    grindRange = mine ? [grindUm - 40, grindUm + 40] : [grindUm - 60, grindUm + 60]
    level = mine ? 'high' : 'medium'
    const who = mine ? 'your locked recipe' : describeCount(pool.length, "a friend's locked recipe", "friends' locked recipes")
    basis = mine
      ? 'You have locked a recipe for this bean, so temperature and grind start from it. The pour structure follows the balance and strength you chose.'
      : `Based on ${who} for this bean. Their grind is converted from their grinder, so small differences are normal. The pour structure follows your balance and strength.`
    dataReasons.push(
      {
        param: 'temp',
        what: `${tempC} °C`,
        why: `Taken from ${who} for this bean.`,
        source: 'data',
      },
      {
        param: 'grind',
        what: `About ${grindUm} µm`,
        why: `Taken from ${who} for this bean${mine ? '' : ', converted from their grinder'}.`,
        source: 'data',
      },
    )
  } else {
    const neighbours = nearestPriors(input.bean, input.method, [...own, ...friends])
    if (neighbours.length > 0) {
      const weight = Math.min(0.4, 0.15 * neighbours.length)
      const total = neighbours.reduce((sum, n) => sum + n.similarity, 0)
      const meanTemp = neighbours.reduce((sum, n) => sum + n.prior.tempC * n.similarity, 0) / total
      const meanGrind = neighbours.reduce((sum, n) => sum + n.prior.grindUm * n.similarity, 0) / total
      tempC = half((1 - weight) * temp.value + weight * meanTemp)
      grindUm = round5((1 - weight) * grind.value + weight * meanGrind)
      if (neighbours.length >= 3) {
        // Enough neighbours to trust: tighten the guidance range by 30% around the blended value.
        const halfWidth = ((temp.range[1] - temp.range[0]) / 2) * 0.7
        tempRange = [Math.round(tempC - halfWidth), Math.round(tempC + halfWidth)]
        grindRange = [round5(grindUm - 70), round5(grindUm + 70)]
        level = 'medium'
      }
      const count = describeCount(neighbours.length, 'similar coffee', 'similar coffees')
      basis =
        neighbours.length >= 3
          ? `Based on the 4:6 method plus ${count} you or your friends have dialed in. Expect one or two brews to settle it.`
          : `Based on the 4:6 method plus ${count}, which is too few to rely on. Expect two or three brews.`
      dataReasons.push({
        param: 'temp',
        what: `Nudged towards ${count}`,
        why: `${Math.round(weight * 100)}% of the starting temperature and grind comes from ${count} (matched on origin, process, roast, variety and notes); the rest is general guidance.`,
        source: 'data',
      })
    }
  }

  // 3. Structure, dose, water.
  const ratioValue = ratio.value
  const waterG = Math.round(doseG * ratioValue)
  const pours = buildPours(waterG, balance, laterPours, gapS)
  const lastPourAt = pours.at(-1)!.atS
  const time = targetTime(lastPourAt, waterG)

  const first = pours[0]!.toG
  const second = pours[1]!.toG - first
  const later = pours.slice(2).map((p, i) => p.toG - pours[i + 1]!.toG)
  reasons.push({
    param: 'structure',
    what: `${first} g, then ${second} g, then ${later.length} pours of about ${Math.round(later.reduce((a, b) => a + b, 0) / later.length)} g`,
    why: `4:6 method: the first 40% of the water (two pours) sets sweet against bright; the last 60% in ${later.length} equal pours sets strength (${input.target.strength}). A bigger first pour is brighter, a smaller one sweeter.`,
    source: 'method',
  })
  if (nudge !== 0 || requested !== input.target.balance) {
    const parts: string[] = []
    if (nudge > 0) parts.push(`Bright notes (${bright.join(', ')}) push the first pour bigger`)
    if (nudge < 0) parts.push(`Sweet notes (${sweet.join(', ')}) push the first pour smaller`)
    if (requested !== input.target.balance) parts.push('the balance was kept within its range')
    reasons.push({
      param: 'balance',
      what: nudge > 0 ? 'Leaning brighter' : nudge < 0 ? 'Leaning sweeter' : 'Balance kept in range',
      why: `${parts.join('; ')}. A small nudge (guidance), your own balance setting still leads.`,
      source: 'guidance',
    })
  }
  reasons.push({
    param: 'dose',
    what: `${doseG} g coffee, ${waterG} g water`,
    why: input.doseG ? 'Your chosen dose.' : `${input.cups} ${input.cups === 1 ? 'cup' : 'cups'} at 10 g of coffee per cup.`,
    source: 'method',
  })

  // Data for this very bean replaces the guidance reasons for temperature and grind.
  const sameBeanData = ownSame.length > 0 || friendSame.length > 0
  const dataTemp = dataReasons.filter((r) => r.param === 'temp')
  const dataGrind = dataReasons.filter((r) => r.param === 'grind')
  reasons.push(...(sameBeanData ? dataTemp : [...temp.reasons, ...dataTemp]))
  reasons.push(...(sameBeanData ? dataGrind : [...grind.reasons, ...dataGrind]))
  reasons.push(...ratio.reasons)
  reasons.push(...time.reasons)
  if (bloomReason) reasons.push(bloomReason)

  const ranges: SuggestOutput['ranges'] = {
    tempC: [Math.min(tempRange[0], tempC), Math.max(tempRange[1], tempC)],
    grindUm: [Math.min(grindRange[0], grindUm), Math.max(grindRange[1], grindUm)],
    ratio: ratio.range,
    targetTimeS: time.range,
  }

  return {
    recipe: {
      doseG,
      waterG,
      ratio: Math.round((waterG / doseG) * 10) / 10,
      tempC,
      grindUm,
      filter: input.filter ?? null,
      pours,
      agitation: null,
      targetTimeS: time.value,
    },
    structure: { balance: Math.round(balance * 100) / 100, laterPours },
    ranges,
    reasons,
    confidence: { level, basis },
  }
}
