import type { FlowClass, SuggestInput } from '../../engine/types.ts'
import type { Bag, FilterRow } from '../data/types'
import type { BrewChoices } from './params'

/** Turns what is on the screen into what the engine needs. */
export function buildSuggestInput(bag: Bag, choices: BrewChoices, filter: FilterRow | null, asOf: string): SuggestInput {
  const { bean } = bag
  return {
    method: 'v60',
    bean: {
      id: bean.id,
      origin: bean.origin,
      region: bean.region,
      process: bean.process,
      variety: bean.variety,
      roastLevel: bean.roastLevel,
      altitudeM: bean.altitudeM,
      notes: bean.roasterNotes,
      roastDate: bag.roastDate,
    },
    // Tasting notes are not sent: whether they change the cup is unproven (docs/brew.md).
    target: { balance: choices.balance, strength: choices.strength, emphasise: [] },
    cups: choices.cups,
    doseG: choices.edits.doseG,
    overrides: {
      waterG: choices.edits.waterG,
      ratio: choices.edits.ratio,
      tempC: choices.edits.tempC,
      grindUm: choices.edits.grindUm,
      pours: choices.edits.pours,
      targetTimeS: choices.edits.targetTimeS,
    },
    filter: filter
      ? { id: filter.id, brand: filter.brand, model: filter.model, flowClass: filter.flow_class as FlowClass | null }
      : null,
    asOf,
  }
}

/** m:ss for a number of seconds. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
