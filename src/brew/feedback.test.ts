import { describe, expect, it } from 'vitest'
import type { RecipeNumbers } from '../data/types'
import { describeChange, diffRecipes, lastBrewLines, toggleExclusive } from './feedback'

const base: RecipeNumbers = { doseG: 20, waterG: 300, ratio: 15, tempC: 95, grindUm: 800, targetTimeS: 180, pours: [{ atS: 0, toG: 300 }] }

describe('toggleExclusive', () => {
  it('adds and removes ordinary chips', () => {
    expect(toggleExclusive(['sour'], 'weak', 'good')).toEqual(['sour', 'weak'])
    expect(toggleExclusive(['sour', 'weak'], 'sour', 'good')).toEqual(['weak'])
  })

  it('lets the exclusive chip stand alone, and drops it when another is picked', () => {
    expect(toggleExclusive(['sour', 'weak'], 'good', 'good')).toEqual(['good'])
    expect(toggleExclusive(['good'], 'bitter', 'good')).toEqual(['bitter'])
    expect(toggleExclusive(['good'], 'good', 'good')).toEqual([])
  })
})

describe('diffRecipes', () => {
  it('lists what changed and ignores rounding', () => {
    expect(diffRecipes(base, { ...base, tempC: 93, grindUm: 780, waterG: 300.2 })).toEqual([
      { param: 'temp', from: 95, to: 93 },
      { param: 'grind', from: 800, to: 780 },
    ])
    expect(diffRecipes(base, { ...base, grindUm: 802 })).toEqual([])
  })
})

describe('describeChange', () => {
  it('says the grind by direction and the temperature in your unit', () => {
    expect(describeChange({ param: 'grind', from: 800, to: 780 }, 'c')).toBe('Grind finer')
    expect(describeChange({ param: 'grind', from: 780, to: 800 }, 'c')).toBe('Grind coarser')
    expect(describeChange({ param: 'temp', from: 95, to: 93 }, 'c')).toBe('Temp 95 → 93°C')
    expect(describeChange({ param: 'dose', from: 18, to: 20 }, 'c')).toBe('Coffee 18 → 20 g')
  })
})

describe('lastBrewLines', () => {
  it('puts each part in words, and is empty for a skipped log', () => {
    const brew = { brewedAt: '', totalTimeS: null, tastes: ['sour', 'weak'], improve: ['sweetness', 'body'], compared: null, yieldG: null, notes: ' hello ', firstPourG: 60 } as const
    expect(lastBrewLines({ ...brew, tastes: [...brew.tastes], improve: [...brew.improve] })).toEqual({ tasted: 'Sour, weak', wanted: 'More sweetness, more body', note: 'hello' })
    expect(lastBrewLines({ ...brew, tastes: [], improve: [], notes: '' })).toEqual({ tasted: null, wanted: null, note: null })
  })
})
