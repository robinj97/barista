import { describe, expect, it } from 'vitest'
import { GRINDER_SEED } from '../../engine/grinderSeed.ts'
import type { StoredSuggestion } from '../../supabase/functions/suggest-tweak/suggest.ts'
import type { BrewResult, Draft, MyGrinder, RecipeNumbers } from '../data/types'
import { DEFAULT_CHOICES, type BrewChoices } from './params'
import { applySuggestion, canSuggest, currentSuggestion, type ApplyInput } from './suggestTweak'

const brewed: RecipeNumbers = {
  doseG: 20, waterG: 300, ratio: 15, tempC: 93, grindUm: 820, targetTimeS: 210,
  pours: [{ atS: 0, toG: 60 }, { atS: 45, toG: 120 }, { atS: 85, toG: 180 }, { atS: 125, toG: 240 }, { atS: 165, toG: 300 }],
}
const choices: BrewChoices = { ...DEFAULT_CHOICES, balance: -0.6, strength: 'medium', edits: {} }
const c40: MyGrinder = { grinder: GRINDER_SEED.find((g) => g.id === 'comandante-c40')!, nickname: null, offsetUm: 0 }

const input = (over: Partial<ApplyInput>): ApplyInput => ({
  choices,
  current: brewed,
  brewed,
  brewedChoices: { balance: -0.6, strength: 'medium' },
  changes: [],
  grinder: undefined,
  unit: 'c',
  recompute: () => brewed,
  ...over,
})

const result: BrewResult = {
  brewedAt: '2026-10-19T08:00:03.102Z', totalTimeS: null, tastes: ['weak'], improve: [], compared: null, yieldG: null, notes: '', firstPourG: 60, recipe: brewed,
}
const draft = (lastBrew: BrewResult | null, suggestion: StoredSuggestion | null = null): Draft => ({
  beanId: 'b', method: 'v60', choices, lastBrew, suggestion, updatedAt: '2026-10-19T08:00:00Z',
})

describe('canSuggest', () => {
  it('needs the brewed numbers and a taste or a note', () => {
    expect(canSuggest(draft(result))).toBe(true)
    expect(canSuggest(draft({ ...result, tastes: [], notes: 'a bit sour' }))).toBe(true)
    expect(canSuggest(draft({ ...result, tastes: [], notes: '  ' }))).toBe(false)
    expect(canSuggest(draft({ ...result, recipe: undefined }))).toBe(false)
    expect(canSuggest(draft(null))).toBe(false)
    expect(canSuggest(undefined)).toBe(false)
  })
})

describe('currentSuggestion', () => {
  const stored = { forBrewedAt: result.brewedAt } as StoredSuggestion
  it('is the saved suggestion only when it was made for this last brew', () => {
    expect(currentSuggestion(draft(result, stored))).toBe(stored)
    expect(currentSuggestion(draft({ ...result, brewedAt: '2026-10-20T08:00:00Z' }, stored))).toBeNull()
    expect(currentSuggestion(draft(result))).toBeNull()
  })
})

describe('applySuggestion', () => {
  it('moves the grind in microns without a calibrated grinder', () => {
    const { choices: next, lines } = applySuggestion(input({ changes: [{ direction: 'finer', amount: 30 }] }))
    expect(next?.edits.grindUm).toBe(790)
    expect(lines).toEqual([{ text: 'Grind finer: 820 → 790 µm', alreadyChanged: false, atLimit: false }])
  })

  it("moves the grind in the person's grinder clicks, at least one click", () => {
    const thirty = applySuggestion(input({ grinder: c40, changes: [{ direction: 'finer', amount: 30 }] }))
    expect(thirty.lines[0]!.text).toBe('Grind finer: 27 → 26 clicks')
    expect(thirty.choices?.edits.grindUm).toBe(790)
    const tiny = applySuggestion(input({ grinder: c40, changes: [{ direction: 'coarser', amount: 10 }] }))
    expect(tiny.lines[0]!.text).toBe('Grind coarser: 27 → 28 clicks')
  })

  it('changes temperature in whole degrees, shown in the person’s unit, never above 100 °C', () => {
    expect(applySuggestion(input({ changes: [{ direction: 'cooler', amount: 2 }] })).choices?.edits.tempC).toBe(91)
    expect(applySuggestion(input({ unit: 'f', changes: [{ direction: 'hotter', amount: 1 }] })).lines[0]!.text).toMatch(/°F$/)
    const hot = applySuggestion(input({ brewed: { ...brewed, tempC: 100 }, changes: [{ direction: 'hotter', amount: 2 }] }))
    expect(hot.choices).toBeNull()
    expect(hot.lines[0]!.atLimit).toBe(true)
  })

  it('tightens the ratio and keeps the coffee', () => {
    const { choices: next, lines } = applySuggestion(input({ changes: [{ direction: 'tighter', amount: 0.5 }] }))
    expect(next?.edits).toMatchObject({ ratio: 14.5 })
    expect(next?.edits.doseG).toBeUndefined()
    expect(lines[0]!.text).toBe('Ratio 1:15 → 1:14.5 (290 g water)')
  })

  it('steps strength and balance, and says when strength is already at the end', () => {
    expect(applySuggestion(input({ changes: [{ direction: 'stronger', amount: null }] })).choices?.strength).toBe('strong')
    const strongest = applySuggestion(input({ brewedChoices: { balance: 0, strength: 'strong' }, changes: [{ direction: 'stronger', amount: null }] }))
    expect(strongest.choices).toBeNull()
    expect(strongest.lines[0]).toMatchObject({ text: 'Already strong', atLimit: true })
    expect(applySuggestion(input({ changes: [{ direction: 'brighter', amount: 0.3 }] })).choices?.balance).toBe(-0.3)
    expect(applySuggestion(input({ brewedChoices: { balance: -1, strength: 'medium' }, changes: [{ direction: 'sweeter', amount: 0.3 }] })).choices).toBeNull()
  })

  it('moves every pour after the first so each gap grows, keeping the water', () => {
    const { choices: next, lines } = applySuggestion(input({ changes: [{ direction: 'longer_gaps', amount: 5 }] }))
    expect(next?.edits.pours?.map((p) => p.atS)).toEqual([0, 50, 95, 140, 185])
    expect(next?.edits.pours?.map((p) => p.toG)).toEqual(brewed.pours.map((p) => p.toG))
    expect(lines[0]!.text).toBe('Pours 5 s further apart')
  })

  it('never makes a gap shorter than 20 s', () => {
    const tight = { ...brewed, pours: [{ atS: 0, toG: 60 }, { atS: 22, toG: 120 }, { atS: 60, toG: 300 }] }
    const { choices: next } = applySuggestion(input({ recompute: () => tight, changes: [{ direction: 'shorter_gaps', amount: 10 }] }))
    expect(next?.edits.pours?.map((p) => p.atS)).toEqual([0, 20, 48])
  })

  it('applies two changes, with pour gaps placed on the pours the other change produces', () => {
    const stronger = { ...brewed, pours: [...brewed.pours, { atS: 205, toG: 300 }] }
    const { choices: next, lines } = applySuggestion(
      input({
        recompute: (c) => (c.strength === 'strong' ? stronger : brewed),
        changes: [{ direction: 'longer_gaps', amount: 5 }, { direction: 'stronger', amount: null }],
      }),
    )
    expect(next?.strength).toBe('strong')
    expect(next?.edits.pours).toHaveLength(6)
    expect(lines.map((l) => l.text)).toEqual(['Strength medium → strong (one more pour)', 'Pours 5 s further apart'])
  })

  it('starts from what was brewed, and flags a value already changed on screen', () => {
    const edited = { ...choices, edits: { grindUm: 760 } }
    const { choices: next, lines } = applySuggestion(input({ choices: edited, current: { ...brewed, grindUm: 760 }, changes: [{ direction: 'finer', amount: 30 }] }))
    expect(next?.edits.grindUm).toBe(790)
    expect(lines[0]!.alreadyChanged).toBe(true)
  })

  it('keeps other edits and leaves the input untouched, so undo is the old choices', () => {
    const edited = { ...choices, edits: { doseG: 18 } }
    const { choices: next } = applySuggestion(input({ choices: edited, changes: [{ direction: 'hotter', amount: 1 }] }))
    expect(next?.edits).toEqual({ doseG: 18, tempC: 94 })
    expect(edited.edits).toEqual({ doseG: 18 })
  })
})
