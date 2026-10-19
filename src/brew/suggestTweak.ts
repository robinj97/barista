import { isCalibrated, micronsToSetting, settingToMicrons } from '../../engine/grinder.ts'
import { LIMITS } from '../../engine/overrides.ts'
import { STRENGTHS, type Pour } from '../../engine/types.ts'
import { formatTemp, type TempUnit } from '../../engine/units.ts'
import { canSuggestFrom, type Change, type StoredBrew, type StoredSuggestion } from '../../supabase/functions/suggest-tweak/suggest.ts'
import type { Draft, MyGrinder, RecipeNumbers } from '../data/types'
import { setGrind, setPours, setRatio, setTemp } from './edits'
import type { BrewChoices } from './params'

/** Whether the Recipe screen offers "Suggest a tweak" for this draft (the feature flag is checked separately). */
export const canSuggest = (draft: Draft | undefined): boolean => canSuggestFrom(draft?.lastBrew as StoredBrew | null | undefined)

/** The suggestion for the draft's current last brew, if there is one. */
export const currentSuggestion = (draft: Draft | undefined): StoredSuggestion | null =>
  draft?.suggestion && draft.lastBrew && draft.suggestion.forBrewedAt === draft.lastBrew.brewedAt ? draft.suggestion : null

/** One change as the card shows it. */
export interface SuggestedLine {
  text: string
  /** The person has their own edit for this value that differs from what was brewed; Apply sets the suggested one anyway. */
  alreadyChanged: boolean
  /** It's at a limit (strongest, 100 °C, the grinder's end...), so there is nothing to change. */
  atLimit: boolean
}

export interface ApplyInput {
  /** The choices on screen now. */
  choices: BrewChoices
  /** The recipe on screen now. */
  current: RecipeNumbers
  /** The numbers that were brewed. */
  brewed: RecipeNumbers
  /** The choices that were brewed (balance and strength). */
  brewedChoices: Pick<BrewChoices, 'balance' | 'strength'>
  changes: Change[]
  grinder: MyGrinder | undefined
  unit: TempUnit
  /** The recipe the engine makes from some choices; used to place pours after other changes. */
  recompute: (choices: BrewChoices) => RecipeNumbers
}

export interface Applied {
  /** The choices after Apply, or null when no change can be applied. */
  choices: BrewChoices | null
  lines: SuggestedLine[]
}

const within = (value: number, [low, high]: readonly [number, number]) => Math.min(high, Math.max(low, value))
const round = (value: number, step: number) => Math.round(Math.round(value / step) * step * 100) / 100
const MIN_GAP_S = 20

function grindTarget(brewedUm: number, change: Change, grinder: MyGrinder | undefined): { um: number; text: string } {
  const finer = change.direction === 'finer'
  const amount = change.amount ?? 20
  const wanted = within(brewedUm + (finer ? -amount : amount), LIMITS.grindUm)
  if (grinder && isCalibrated(grinder.grinder)) {
    const { grinder: model, offsetUm } = grinder
    const from = micronsToSetting(model, brewedUm, offsetUm).setting
    let to = micronsToSetting(model, wanted, offsetUm).setting
    // Always at least one step, so "finer" never means "the same click".
    if (to === from) to = round(from + (finer ? -model.step : model.step), model.step)
    if (model.min != null) to = Math.max(model.min, to)
    if (model.max != null) to = Math.min(model.max, to)
    const um = Math.round(settingToMicrons(model, to, offsetUm).microns)
    return { um: to === from ? brewedUm : um, text: `Grind ${finer ? 'finer' : 'coarser'}: ${from} → ${to} ${model.unitLabel}` }
  }
  const um = round(wanted, 5)
  return { um, text: `Grind ${finer ? 'finer' : 'coarser'}: ${brewedUm} → ${um} µm` }
}

/** Every pour after the first moves by `amount` more than the one before, so each gap changes by `amount`. */
function shiftPours(pours: Pour[], amount: number): Pour[] {
  const shifted: Pour[] = []
  pours.forEach((pour, i) => {
    if (i === 0) return shifted.push(pour)
    const gap = pour.atS - pours[i - 1]!.atS
    shifted.push({ ...pour, atS: shifted[i - 1]!.atS + Math.max(MIN_GAP_S, gap + amount) })
  })
  return shifted
}

/**
 * Turns a suggestion into choices. Each change starts from the value that was brewed (so the step
 * means what Claude meant) and goes through the same edit helpers as editing by hand. Pour gaps are
 * applied last, on the pours the other changes produce.
 */
export function applySuggestion(input: ApplyInput): Applied {
  const { brewed, brewedChoices, current, grinder, unit } = input
  const { edits } = input.choices
  // Only a value the person set themselves counts: the engine's own suggestion can differ from what was brewed.
  const edited = (value: number | undefined, was: number) => value !== undefined && value !== was
  let choices = input.choices
  let changed = false
  const lines: SuggestedLine[] = []
  const line = (text: string, alreadyChanged: boolean, atLimit: boolean) => {
    lines.push({ text, alreadyChanged, atLimit })
    changed ||= !atLimit
  }

  const gapChange = input.changes.find((c) => c.direction === 'longer_gaps' || c.direction === 'shorter_gaps')
  for (const change of input.changes) {
    if (change === gapChange) continue
    const amount = change.amount ?? 0
    switch (change.direction) {
      case 'finer':
      case 'coarser': {
        const { um, text } = grindTarget(brewed.grindUm, change, grinder)
        const atLimit = um === brewed.grindUm
        if (!atLimit) choices = setGrind(choices, um)
        line(text, edited(edits.grindUm, brewed.grindUm), atLimit)
        break
      }
      case 'hotter':
      case 'cooler': {
        const tempC = within(Math.round(brewed.tempC + (change.direction === 'hotter' ? amount : -amount)), [LIMITS.tempC[0], 100])
        const atLimit = tempC === brewed.tempC
        if (!atLimit) choices = setTemp(choices, tempC)
        line(`Water ${formatTemp(brewed.tempC, unit)} → ${formatTemp(tempC, unit)}`, edited(edits.tempC, brewed.tempC), atLimit)
        break
      }
      case 'tighter':
      case 'looser': {
        const ratio = within(round(brewed.ratio + (change.direction === 'looser' ? amount : -amount), 0.5), LIMITS.ratio)
        const atLimit = ratio === brewed.ratio
        if (!atLimit) choices = setRatio(choices, ratio, current.doseG, 'coffee', { ratio: current.waterG / current.doseG, waterG: current.waterG })
        line(`Ratio 1:${brewed.ratio} → 1:${ratio} (${Math.round(current.doseG * ratio)} g water)`, edited(edits.ratio, brewed.ratio), atLimit)
        break
      }
      case 'stronger':
      case 'lighter': {
        const at = STRENGTHS.indexOf(brewedChoices.strength)
        const to = STRENGTHS[Math.min(STRENGTHS.length - 1, Math.max(0, at + (change.direction === 'stronger' ? 1 : -1)))]!
        const atLimit = to === brewedChoices.strength
        if (!atLimit) choices = { ...choices, strength: to }
        line(
          atLimit ? `Already ${brewedChoices.strength}` : `Strength ${brewedChoices.strength} → ${to} (${change.direction === 'stronger' ? 'one more pour' : 'one pour fewer'})`,
          input.choices.strength !== brewedChoices.strength,
          atLimit,
        )
        break
      }
      case 'sweeter':
      case 'brighter': {
        const balance = within(round(brewedChoices.balance + (change.direction === 'brighter' ? amount : -amount), 0.1), [-1, 1])
        const atLimit = balance === brewedChoices.balance
        if (!atLimit) choices = { ...choices, balance }
        line(`Balance ${change.direction === 'sweeter' ? 'sweeter' : 'brighter'}: ${brewedChoices.balance} → ${balance}`, input.choices.balance !== brewedChoices.balance, atLimit)
        break
      }
    }
  }

  if (gapChange) {
    const amount = (gapChange.amount ?? 5) * (gapChange.direction === 'longer_gaps' ? 1 : -1)
    const pours = input.recompute(choices).pours
    const shifted = shiftPours(pours, amount)
    const atLimit = shifted.every((pour, i) => pour.atS === pours[i]!.atS)
    if (!atLimit) choices = setPours(choices, shifted)
    line(`Pours ${Math.abs(amount)} s ${amount > 0 ? 'further apart' : 'closer together'}`, input.choices.edits.pours !== undefined, atLimit)
  }

  return { choices: changed ? choices : null, lines }
}
