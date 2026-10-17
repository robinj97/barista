import { describe, expect, it } from 'vitest'
import { DEFAULT_CHOICES, GOAL_LABELS, goalOf, parseChoices, toSearchParams, type BrewChoices } from './params'

const parse = (query: string) => parseChoices(new URLSearchParams(query))

describe('parseChoices', () => {
  it('uses the defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_CHOICES)
  })

  it('reads every choice', () => {
    expect(parse('bag=b1&balance=-0.6&strength=strong&grinder=g1&filter=none&cups=3')).toEqual({
      bagId: 'b1',
      balance: -0.6,
      strength: 'strong',
      grinderId: 'g1',
      filterId: 'none',
      cups: 3,
      edits: {},
    })
  })

  it('ignores junk and clamps what it can', () => {
    const got = parse('balance=banana&strength=huge&cups=9')
    expect(got.balance).toBe(0)
    expect(got.strength).toBe('medium')
    expect(got.cups).toBe(2)
    expect(parse('balance=5').balance).toBe(1)
    expect(parse('balance=-5').balance).toBe(-1)
    expect(parse('cups=1.5').cups).toBe(2)
    expect(parse('cups=0').cups).toBe(2)
  })

  it('rounds the balance to a tenth', () => {
    expect(parse('balance=0.2549').balance).toBe(0.3)
  })

  it('ignores the notes older links may still carry', () => {
    expect(parse('notes=vanilla,jasmine')).toEqual(DEFAULT_CHOICES)
  })
})

describe('toSearchParams', () => {
  it('round-trips', () => {
    const choices: BrewChoices = {
      bagId: 'b1', balance: 0.6, strength: 'light', grinderId: 'g1', filterId: 'f1', cups: 4, edits: {},
    }
    expect(parseChoices(toSearchParams(choices))).toEqual(choices)
  })

  it('leaves out what is not chosen', () => {
    const params = toSearchParams(DEFAULT_CHOICES)
    expect(params.has('bag')).toBe(false)
    expect(params.has('grinder')).toBe(false)
    expect(params.has('filter')).toBe(false)
  })
})

describe('recipe edits in the URL', () => {
  const edits = { doseG: 15.5, waterG: 240, tempC: 91.5, grindUm: 780, targetTimeS: 170, pours: [{ atS: 0, toG: 50 }, { atS: 40, toG: 240 }] }

  it('round-trips', () => {
    const choices: BrewChoices = { ...DEFAULT_CHOICES, bagId: 'b1', edits }
    expect(parseChoices(toSearchParams(choices))).toEqual(choices)
  })

  it('writes nothing when nothing is edited', () => {
    const query = toSearchParams(DEFAULT_CHOICES)
    for (const key of ['dose', 'water', 'ratio', 'temp', 'grind', 'pours', 'time']) expect(query.has(key)).toBe(false)
  })

  it('drops values outside the limits and pours the engine would refuse', () => {
    expect(parse('dose=500&water=abc&ratio=2&temp=200&grind=5&time=0').edits).toEqual({})
    expect(parse('pours=0:50,0:90').edits).toEqual({})
    expect(parse('pours=10:50').edits).toEqual({})
    expect(parse('dose=16&pours=0:50,40:40').edits).toEqual({ doseG: 16 })
  })
})

describe('goalOf', () => {
  it('names the presets and leaves a custom balance unnamed', () => {
    expect(goalOf(-0.6)).toBe('sweeter')
    expect(goalOf(0)).toBe('balanced')
    expect(goalOf(0.6)).toBe('brighter')
    expect(goalOf(0.3)).toBeNull()
  })
})

describe('goal labels', () => {
  it('call the high-acidity goal "More acidity", never sour or harsh', () => {
    expect(GOAL_LABELS).toEqual({ sweeter: 'Sweeter', balanced: 'Balanced', brighter: 'More acidity' })
  })
})
