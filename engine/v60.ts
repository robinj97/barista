import { clamp, mean, roundDp, widenTo } from './math.ts'
import { noteNudge } from './notes.ts'
import { overriddenKeys, scalePours } from './overrides.ts'
import { buildPours, laterPoursFor } from './pours.ts'
import { bloomGap, describeGrind, describeTemp, ratioPrior, targetTime } from './priors.ts'
import { startingPoint } from './start.ts'
import type { OverrideKey, Pour, Reason, Strength, SuggestInput, SuggestOutput } from './types.ts'

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const mine = (param: Reason['param'], what: string, why: string): Reason => ({ param, what, why, source: 'you' })

/**
 * The V60 recommender: a parametric 4:6 (docs/engine.md section 3), with anything the person set
 * by hand applied on top and recorded in `overridden`. Input is already validated.
 */
export function suggestV60(input: SuggestInput, doseG: number): SuggestOutput {
  const { strength } = input.target
  const o = input.overrides ?? {}
  const requested = clamp(input.target.balance, -1, 1)
  const notes = noteNudge(input.target.emphasise)
  const balance = clamp(requested + notes.nudge, -1, 1)
  const laterPours = laterPoursFor(strength)
  const bloom = bloomGap(input.bean.roastDate, input.asOf)
  const start = startingPoint(input)
  const ratioEst = ratioPrior(strength)

  // Water: custom pours decide it (scaled to an explicit water amount), else a water amount, else a ratio.
  const waterG = o.waterG ?? (o.pours ? o.pours.at(-1)!.toG : Math.round(doseG * (o.ratio ?? ratioEst.value)))
  const pours: Pour[] = o.pours
    ? scalePours(o.pours, waterG)
    : buildPours(waterG, balance, laterPours, bloom.gapS)
  const ratio = roundDp(waterG / doseG, 1)
  const time = o.targetTimeS !== undefined ? o.targetTimeS : targetTime(pours.at(-1)!.atS, waterG).value
  const timeRange = widenTo(targetTime(pours.at(-1)!.atS, waterG).range, time)
  const tempC = o.tempC ?? start.temp.value
  const grindUm = o.grindUm ?? start.grind.value

  const overridden = overriddenKeys(input.doseG !== undefined, o)
  const set = (key: OverrideKey) => overridden.includes(key)

  return {
    recipe: {
      doseG,
      waterG,
      ratio,
      tempC,
      grindUm,
      filter: input.filter ?? null,
      pours,
      agitation: null,
      targetTimeS: time,
    },
    structure: { balance: roundDp(balance, 2), laterPours: o.pours ? o.pours.length - 2 : laterPours },
    ranges: {
      tempC: widenTo(start.temp.range, tempC),
      grindUm: widenTo(start.grind.range, grindUm),
      ratio: widenTo(ratioEst.range, ratio),
      targetTimeS: timeRange,
    },
    reasons: [
      ...(o.pours
        ? [mine('structure', `Your own pours: ${pours.map((p, i) => p.toG - (pours[i - 1]?.toG ?? 0)).join(' g, ')} g`, 'You set the pours yourself, so the balance and strength settings no longer apply.')]
        : [structureReason(pours, strength), ...balanceReason(input.target.balance, requested, balance, notes)]),
      doseReason(input, doseG, waterG, ratio, set),
      ...(set('tempC') ? [mine('temp', describeTemp(tempC), 'You set the water temperature.')] : start.temp.reasons),
      ...(set('grindUm') ? [mine('grind', describeGrind(grindUm), 'You set the grind.')] : start.grind.reasons),
      ...(set('ratio') || set('waterG')
        ? [mine('ratio', `1:${ratio}`, set('ratio') ? 'You set the ratio.' : 'Worked out from your coffee and water.')]
        : ratioEst.reasons),
      ...(set('targetTimeS') ? [mine('time', `${minutes(time)} in total`, 'You set the total time.')] : targetTime(pours.at(-1)!.atS, waterG).reasons),
      ...(bloom.reason && !o.pours ? [bloom.reason] : []),
    ],
    confidence: start.confidence,
    overridden,
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

function doseReason(input: SuggestInput, doseG: number, waterG: number, ratio: number, set: (key: OverrideKey) => boolean): Reason {
  const yours = [set('doseG') && 'the coffee dose', set('waterG') && 'the water', set('pours') && 'the pours'].filter(Boolean)
  const what = `${doseG} g coffee, ${waterG} g water (1:${ratio})`
  if (yours.length > 0) return mine('dose', what, `You set ${yours.join(' and ')}.`)
  const cups = `${input.cups} ${input.cups === 1 ? 'cup' : 'cups'} at 10 g of coffee per cup.`
  return { param: 'dose', what, why: cups, source: 'method' }
}
