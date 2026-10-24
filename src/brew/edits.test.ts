import { describe, expect, it } from 'vitest'
import { suggest } from '../../engine/suggest.ts'
import { makeBag } from '../test/renderApp'
import { buildSuggestInput } from './buildInput'
import { clearEdits, doseFor, hasEdits, resetEdit, resumeChoices, setCups, setDose, setGoal, setPours, setRatio, setTemp, setWater } from './edits'
import { DEFAULT_CHOICES, type BrewChoices } from './params'

const shown = { ratio: 15, waterG: 300 }
const base: BrewChoices = { ...DEFAULT_CHOICES, bagId: 'b1' }
const pours = [{ atS: 0, toG: 50 }, { atS: 40, toG: 120 }]

describe('coffee', () => {
  it('keeps the ratio by default: only the dose is sent, water follows in the engine', () => {
    expect(setDose(base, 15, 'ratio', shown).edits).toEqual({ doseG: 15 })
  })

  it('keeps the water on request, which changes the ratio', () => {
    expect(setDose({ ...base, edits: { ratio: 16 } }, 15, 'water', shown).edits).toEqual({ doseG: 15, waterG: 300 })
  })

  it('with your own water or pours, hands the engine the water that keeps the ratio', () => {
    expect(setDose({ ...base, edits: { waterG: 320 } }, 15, 'ratio', { ratio: 16, waterG: 320 }).edits).toEqual({ doseG: 15, waterG: 240 })
    expect(setDose({ ...base, edits: { pours } }, 10, 'ratio', { ratio: 12, waterG: 120 }).edits).toEqual({ pours, doseG: 10, waterG: 120 })
  })
})

describe('water and ratio', () => {
  it('water keeps your coffee and drops a ratio', () => {
    expect(setWater({ ...base, edits: { doseG: 18, ratio: 16 } }, 280, 'coffee', shown).edits).toEqual({ doseG: 18, waterG: 280 })
  })

  it('ratio keeps your coffee and drops a water amount', () => {
    expect(setRatio({ ...base, edits: { doseG: 18, waterG: 280 } }, 16, 18, 'coffee', shown).edits).toEqual({ doseG: 18, ratio: 16 })
  })

  it('ratio with your own pours becomes a water amount, as pours cannot take a ratio', () => {
    expect(setRatio({ ...base, edits: { pours, doseG: 20 } }, 10, 20, 'coffee', shown).edits).toEqual({ pours, doseG: 20, waterG: 200 })
  })

  it('own pours replace earlier water and ratio edits', () => {
    expect(setPours({ ...base, edits: { waterG: 250, ratio: 14, tempC: 90 } }, pours).edits).toEqual({ tempC: 90, pours })
  })
})

describe('calculating the coffee from a target', () => {
  it('water with the ratio kept: 400 g at the shown 1:16 is 25 g of coffee', () => {
    expect(setWater(base, 400, 'ratio', { ratio: 16, waterG: 300 }).edits).toEqual({ waterG: 400, doseG: 25 })
  })

  it('water with the ratio kept replaces an earlier coffee edit and ratio', () => {
    expect(setWater({ ...base, edits: { doseG: 18, ratio: 14 } }, 300, 'ratio', shown).edits).toEqual({ waterG: 300, doseG: 20 })
  })

  it('ratio with the water kept: 300 g at 1:16 is 18.8 g of coffee', () => {
    expect(setRatio(base, 16, 20, 'water', shown).edits).toEqual({ waterG: 300, doseG: 18.8 })
  })

  it('ratio with the water kept also works with your own pours', () => {
    expect(setRatio({ ...base, edits: { pours } }, 12, 20, 'water', { ratio: 6, waterG: 120 }).edits).toEqual({ pours, waterG: 120, doseG: 10 })
  })

  it('rounds the coffee to a tenth of a gram', () => {
    expect(doseFor(250, 16)).toBe(15.6)
  })
})

describe('cups', () => {
  it('clears your coffee and water', () => {
    expect(setCups({ ...base, edits: { doseG: 15, waterG: 240, tempC: 90 } }, 3, shown)).toMatchObject({ cups: 3, edits: { tempC: 90 } })
  })

  it('keeps own pours scaled to the new size', () => {
    expect(setCups({ ...base, edits: { pours } }, 1, shown).edits).toEqual({ pours, waterG: 150 })
  })
})

describe('reset', () => {
  it('puts back one thing, or everything', () => {
    const choices = setTemp(setWater(base, 250, 'coffee', shown), 90)
    expect(resetEdit(choices, 'tempC').edits).toEqual({ waterG: 250 })
    expect(clearEdits(choices).edits).toEqual({})
    expect(hasEdits(choices)).toBe(true)
    expect(hasEdits(clearEdits(choices))).toBe(false)
  })
})

describe('sweetness and strength (setGoal)', () => {
  // Robin's Dukorere draft from prod: grind, temperature, coffee and water set by hand.
  const dialed: BrewChoices = { ...base, balance: -0.6, strength: 'medium', edits: { doseG: 16.9, tempC: 92, waterG: 270, grindUm: 711 } }
  const custom = [{ atS: 0, toG: 54 }, { atS: 50, toG: 108 }, { atS: 95, toG: 162 }, { atS: 140, toG: 216 }, { atS: 180, toG: 270 }]

  it('changes only sweetness or strength, and keeps every edit as it was', () => {
    expect(setGoal(dialed, { balance: -0.9 })).toEqual({ ...dialed, balance: -0.9 })
    expect(setGoal(dialed, { strength: 'strong' })).toEqual({ ...dialed, strength: 'strong' })
  })

  it('in the engine, a sweeter balance moves only the pours: grind, temperature, coffee, water and time stay', () => {
    const bag = makeBag('b-geisha')
    const recipeFor = (choices: BrewChoices) => suggest(buildSuggestInput(bag, choices, null, '2026-10-24')).recipe
    const before = recipeFor(dialed)
    const after = recipeFor(setGoal(dialed, { balance: -0.9 }))
    for (const key of ['grindUm', 'tempC', 'doseG', 'waterG', 'ratio', 'targetTimeS'] as const) expect(after[key]).toBe(before[key])
    expect(after.pours[0]!.toG).toBeLessThan(before.pours[0]!.toG)
    expect(after.pours.map((p) => p.atS)).toEqual(before.pours.map((p) => p.atS))
  })

  it('with your own pours, makes sweetness count: same water and pour times, a smaller first pour', () => {
    const next = setGoal({ ...dialed, edits: { ...dialed.edits, pours: custom } }, { balance: -0.9 })
    const pours = next.edits.pours!
    expect(pours.map((p) => p.atS)).toEqual(custom.map((p) => p.atS))
    expect(pours.at(-1)!.toG).toBe(270)
    expect(pours[0]!.toG).toBeLessThan(custom[0]!.toG)
    expect(next.edits).toMatchObject({ doseG: 16.9, tempC: 92, grindUm: 711 })
  })

  it('with your own pours, a strength change adds a pour after your last gap and keeps your earlier times', () => {
    const next = setGoal({ ...dialed, edits: { ...dialed.edits, pours: custom } }, { strength: 'strong' })
    const pours = next.edits.pours!
    expect(pours).toHaveLength(6)
    expect(pours.slice(0, 5).map((p) => p.atS)).toEqual(custom.map((p) => p.atS))
    expect(pours[5]!.atS).toBe(220)
    expect(pours.at(-1)!.toG).toBe(270)
  })

  it('with your own pours, a lighter cup drops the last pour and keeps the others in place', () => {
    const pours = setGoal({ ...dialed, edits: { ...dialed.edits, pours: custom } }, { strength: 'light' }).edits.pours!
    expect(pours.map((p) => p.atS)).toEqual([0, 50, 95, 140])
    expect(pours.at(-1)!.toG).toBe(270)
  })
})

describe('resumeChoices', () => {
  const draft = { ...base, bagId: 'old-bag', balance: -0.3, strength: 'strong' as const, cups: 1, edits: { grindUm: 729, tempC: 92 } }

  it("starts from the bean's working recipe, on the bag you picked", () => {
    expect(resumeChoices('b2', draft, base)).toEqual({ ...draft, bagId: 'b2' })
  })

  it('with no working recipe, starts from the suggestion: your goal stays, edits from another bean go', () => {
    const current = { ...base, balance: 0.4, edits: { grindUm: 600 } }
    expect(resumeChoices('b2', undefined, current)).toEqual({ ...current, bagId: 'b2', edits: {} })
  })
})

