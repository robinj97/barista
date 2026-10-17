import { describe, expect, it } from 'vitest'
import { clearEdits, hasEdits, resetEdit, setCups, setDose, setPours, setRatio, setTemp, setWater } from './edits'
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
    expect(setWater({ ...base, edits: { doseG: 18, ratio: 16 } }, 280).edits).toEqual({ doseG: 18, waterG: 280 })
  })

  it('ratio keeps your coffee and drops a water amount', () => {
    expect(setRatio({ ...base, edits: { doseG: 18, waterG: 280 } }, 16, 18).edits).toEqual({ doseG: 18, ratio: 16 })
  })

  it('ratio with your own pours becomes a water amount, as pours cannot take a ratio', () => {
    expect(setRatio({ ...base, edits: { pours, doseG: 20 } }, 10, 20).edits).toEqual({ pours, doseG: 20, waterG: 200 })
  })

  it('own pours replace earlier water and ratio edits', () => {
    expect(setPours({ ...base, edits: { waterG: 250, ratio: 14, tempC: 90 } }, pours).edits).toEqual({ tempC: 90, pours })
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
    const choices = setTemp(setWater(base, 250), 90)
    expect(resetEdit(choices, 'tempC').edits).toEqual({ waterG: 250 })
    expect(clearEdits(choices).edits).toEqual({})
    expect(hasEdits(choices)).toBe(true)
    expect(hasEdits(clearEdits(choices))).toBe(false)
  })
})
