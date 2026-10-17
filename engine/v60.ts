import { clamp, mean, roundDp } from './math.ts'
import { noteNudge } from './notes.ts'
import { buildPours, laterPoursFor } from './pours.ts'
import { bloomGap, ratioPrior, targetTime } from './priors.ts'
import { startingPoint } from './start.ts'
import type { Pour, Reason, Strength, SuggestInput, SuggestOutput } from './types.ts'

/** The V60 recommender: a parametric 4:6 (docs/engine.md section 3). Input is already validated. */
export function suggestV60(input: SuggestInput, doseG: number): SuggestOutput {
  const { strength } = input.target
  const requested = clamp(input.target.balance, -1, 1)
  const notes = noteNudge(input.target.emphasise)
  const balance = clamp(requested + notes.nudge, -1, 1)
  const laterPours = laterPoursFor(strength)
  const bloom = bloomGap(input.bean.roastDate, input.asOf)
  const start = startingPoint(input)
  const ratio = ratioPrior(strength)

  const waterG = Math.round(doseG * ratio.value)
  const pours = buildPours(waterG, balance, laterPours, bloom.gapS)
  const time = targetTime(pours.at(-1)!.atS, waterG)

  return {
    recipe: {
      doseG,
      waterG,
      ratio: roundDp(waterG / doseG, 1),
      tempC: start.temp.value,
      grindUm: start.grind.value,
      filter: input.filter ?? null,
      pours,
      agitation: null,
      targetTimeS: time.value,
    },
    structure: { balance: roundDp(balance, 2), laterPours },
    ranges: { tempC: start.temp.range, grindUm: start.grind.range, ratio: ratio.range, targetTimeS: time.range },
    reasons: [
      structureReason(pours, strength),
      ...balanceReason(input.target.balance, requested, balance, notes),
      doseReason(input, doseG, waterG),
      ...start.temp.reasons,
      ...start.grind.reasons,
      ...ratio.reasons,
      ...time.reasons,
      ...(bloom.reason ? [bloom.reason] : []),
    ],
    confidence: start.confidence,
  }
}

function structureReason(pours: Pour[], strength: Strength): Reason {
  const [first, second, ...later] = pours.map((pour, i) => pour.toG - (pours[i - 1]?.toG ?? 0))
  return {
    param: 'structure',
    what: `${first} g, then ${second} g, then ${later.length} pours of about ${Math.round(mean(later))} g`,
    why: `4:6 method: the first 40% of the water (two pours) sets sweet against bright; the last 60% in ${later.length} equal pours sets strength (${strength}). A bigger first pour is brighter, a smaller one sweeter.`,
    source: 'method',
  }
}

/** Explains what changed the balance between the dial and the pours, if anything did. */
function balanceReason(asked: number, requested: number, balance: number, notes: ReturnType<typeof noteNudge>): Reason[] {
  const shift = balance - requested
  const sentences: string[] = []
  if (requested !== asked) sentences.push('Your balance setting was past the end of the dial, so it was kept at the end.')
  if (shift > 0) sentences.push(`Bright notes (${notes.bright.join(', ')}) make the first pour a little bigger.`)
  else if (shift < 0) sentences.push(`Sweet notes (${notes.sweet.join(', ')}) make the first pour a little smaller.`)
  else if (notes.nudge !== 0) sentences.push('The notes you picked would push the balance further, but it is already at the end of the dial.')
  if (sentences.length === 0) return []

  const what = shift > 0 ? 'Leaning brighter' : shift < 0 ? 'Leaning sweeter' : 'Balance at the end of the dial'
  return [{ param: 'balance', what, why: `${sentences.join(' ')} Notes only nudge (guidance); your own balance setting still leads.`, source: 'guidance' }]
}

function doseReason(input: SuggestInput, doseG: number, waterG: number): Reason {
  const cups = `${input.cups} ${input.cups === 1 ? 'cup' : 'cups'} at 10 g of coffee per cup.`
  return { param: 'dose', what: `${doseG} g coffee, ${waterG} g water`, why: input.doseG === undefined ? cups : 'Your chosen dose.', source: 'method' }
}
