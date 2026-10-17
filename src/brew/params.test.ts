import { describe, expect, it } from 'vitest'
import { DEFAULT_CHOICES, goalOf, parseChoices, toSearchParams, type BrewChoices } from './params'

const parse = (query: string) => parseChoices(new URLSearchParams(query))

describe('parseChoices', () => {
  it('uses the defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_CHOICES)
  })

  it('reads every choice', () => {
    expect(parse('bag=b1&balance=-0.6&strength=strong&notes=Vanilla,black%20tea&grinder=g1&filter=none&cups=3')).toEqual({
      bagId: 'b1',
      balance: -0.6,
      strength: 'strong',
      notes: ['vanilla', 'black tea'],
      grinderId: 'g1',
      filterId: 'none',
      cups: 3,
    })
  })

  it('ignores junk and clamps what it can', () => {
    const got = parse('balance=banana&strength=huge&cups=9&notes=,,a,a,')
    expect(got.balance).toBe(0)
    expect(got.strength).toBe('medium')
    expect(got.cups).toBe(2)
    expect(got.notes).toEqual(['a'])
    expect(parse('balance=5').balance).toBe(1)
    expect(parse('balance=-5').balance).toBe(-1)
    expect(parse('cups=1.5').cups).toBe(2)
    expect(parse('cups=0').cups).toBe(2)
  })

  it('rounds the balance to a tenth and caps the notes', () => {
    expect(parse('balance=0.2549').balance).toBe(0.3)
    expect(parse('notes=a,b,c,d,e,f,g,h').notes).toHaveLength(6)
  })
})

describe('toSearchParams', () => {
  it('round-trips', () => {
    const choices: BrewChoices = {
      bagId: 'b1', balance: 0.6, strength: 'light', notes: ['jasmine', 'black tea'], grinderId: 'g1', filterId: 'f1', cups: 4,
    }
    expect(parseChoices(toSearchParams(choices))).toEqual(choices)
  })

  it('leaves out what is not chosen', () => {
    const params = toSearchParams(DEFAULT_CHOICES)
    expect(params.has('bag')).toBe(false)
    expect(params.has('notes')).toBe(false)
    expect(params.has('grinder')).toBe(false)
    expect(params.has('filter')).toBe(false)
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
