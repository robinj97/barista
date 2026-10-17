import { describe, expect, it } from 'vitest'
import { suggest } from '../../engine/suggest.ts'
import type { BrewChoices } from './params'
import { DEFAULT_CHOICES } from './params'
import { buildSuggestInput } from './buildInput'
import { ownPriors } from './ownPriors'
import { makeBag } from '../test/renderApp'
import type { BrewResult, Draft, LockedRecipe } from '../data/types'

const bag = makeBag('b-geisha')
const choices: BrewChoices = { ...DEFAULT_CHOICES, bagId: bag.id }
const numbers = { doseG: 20, waterG: 300, ratio: 15, tempC: 91, grindUm: 700, targetTimeS: 180, pours: [{ atS: 0, toG: 300 }] }
const locked = (extra: Partial<LockedRecipe> = {}): LockedRecipe => ({
  id: 'r1', beanId: 'b-geisha', method: 'v60', name: 'V60', versionId: 'v1', snapshot: { choices, recipe: numbers }, rating: 4, lockedAt: '2026-10-10T10:00:00Z', brewCount: 1, ...extra,
})
const brew = (extra: Partial<BrewResult> = {}): BrewResult => ({ brewedAt: '2026-10-12T10:00:00Z', totalTimeS: 170, taste: 'good', compared: null, yieldG: null, notes: '', firstPourG: 60, ...extra })
const draft = (lastBrew: BrewResult | null, edits = {}): Draft => ({ beanId: 'b-geisha', method: 'v60', choices: { ...choices, edits }, lastBrew, updatedAt: '2026-10-12T10:00:00Z' })
const asOf = '2026-10-17'

describe('ownPriors', () => {
  it('uses a locked recipe for its bean', () => {
    expect(ownPriors({ recipes: [locked()], drafts: [], bags: [bag], filters: [], asOf })).toMatchObject([{ beanId: 'b-geisha', tempC: 91, grindUm: 700 }])
  })

  it('skips a recipe whose bean you have no bag for', () => {
    expect(ownPriors({ recipes: [locked({ beanId: 'b-elto' })], drafts: [], bags: [bag], filters: [], asOf })).toEqual([])
  })

  it('lets a newer working recipe that tasted good replace the locked one', () => {
    const priors = ownPriors({ recipes: [locked()], drafts: [draft(brew(), { tempC: 93, grindUm: 650 })], bags: [bag], filters: [], asOf })
    expect(priors).toHaveLength(1)
    expect(priors[0]).toMatchObject({ tempC: 93, grindUm: 650 })
  })

  it('does not start from a brew that tasted sour, or one older than the lock', () => {
    expect(ownPriors({ recipes: [locked()], drafts: [draft(brew({ taste: 'sour' }), { tempC: 93 })], bags: [bag], filters: [], asOf })[0]).toMatchObject({ tempC: 91 })
    expect(ownPriors({ recipes: [locked()], drafts: [draft(brew({ brewedAt: '2026-10-01T10:00:00Z' }), { tempC: 93 })], bags: [bag], filters: [], asOf })[0]).toMatchObject({ tempC: 91 })
  })

  it('uses a good working recipe when nothing is locked, and ignores one never brewed', () => {
    expect(ownPriors({ recipes: [], drafts: [draft(brew(), { tempC: 93 })], bags: [bag], filters: [], asOf })).toHaveLength(1)
    expect(ownPriors({ recipes: [], drafts: [draft(null, { tempC: 93 })], bags: [bag], filters: [], asOf })).toEqual([])
  })
})

describe('suggestions from your own recipes', () => {
  it('start from the locked recipe and say so', () => {
    const own = ownPriors({ recipes: [locked()], drafts: [], bags: [bag], filters: [], asOf })
    const out = suggest(buildSuggestInput(bag, choices, null, asOf, own))
    expect(out.recipe.tempC).toBe(91)
    expect(out.recipe.grindUm).toBe(700)
    expect(out.confidence.level).toBe('high')
    expect(suggest(buildSuggestInput(bag, choices, null, asOf)).confidence.level).toBe('low')
  })
})
