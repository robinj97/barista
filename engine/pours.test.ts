import { describe, expect, it } from 'vitest'
import { buildPours, derivePourParams, laterPoursFor, pourTimes } from './pours.ts'

const grams = (water: number, balance: number, later: number) => buildPours(water, balance, later).map((p) => p.toG)

describe('buildPours: the reference recipe', () => {
  it('gives 60, 120, 180, 240, 300 for a balanced medium 300 g brew', () => {
    expect(grams(300, 0, laterPoursFor('medium'))).toEqual([60, 120, 180, 240, 300])
  })

  it('splits the first 40% for sweeter and brighter', () => {
    expect(grams(300, -1, 3).slice(0, 2)).toEqual([40, 120]) // 40 then 80
    expect(grams(300, 1, 3).slice(0, 2)).toEqual([80, 120]) // 80 then 40
  })

  it('divides the last 60% by strength', () => {
    expect(grams(300, 0, laterPoursFor('light'))).toEqual([60, 120, 210, 300])
    expect(grams(300, 0, laterPoursFor('strong'))).toEqual([60, 120, 165, 210, 255, 300])
  })
})

describe('buildPours: properties', () => {
  const cases = [
    ...[150, 200, 225, 300, 320, 450].flatMap((water) =>
      [-1, -0.5, 0, 0.4, 1].flatMap((balance) => [1, 2, 3, 4].map((later) => ({ water, balance, later }))),
    ),
  ]

  it.each(cases)('stays valid for $water g, balance $balance, $later later pours', ({ water, balance, later }) => {
    const pours = buildPours(water, balance, later)
    expect(pours).toHaveLength(later + 2)
    expect(pours.at(-1)!.toG).toBe(water)
    pours.forEach((pour, i) => {
      if (i > 0) {
        expect(pour.toG).toBeGreaterThan(pours[i - 1]!.toG)
        expect(pour.atS).toBeGreaterThan(pours[i - 1]!.atS)
      }
    })
    expect(pours[0]!.atS).toBe(0)
  })

  it('makes the first pour bigger as the balance goes brighter', () => {
    let previous = 0
    for (const balance of [-1, -0.5, 0, 0.5, 1]) {
      const first = buildPours(300, balance, 3)[0]!.toG
      expect(first).toBeGreaterThan(previous)
      previous = first
    }
  })

  it('adds pours as strength goes up', () => {
    expect(laterPoursFor('light')).toBeLessThan(laterPoursFor('medium'))
    expect(laterPoursFor('medium')).toBeLessThan(laterPoursFor('strong'))
  })

  it('clamps a balance outside the range', () => {
    expect(grams(300, 5, 3)).toEqual(grams(300, 1, 3))
    expect(grams(300, -5, 3)).toEqual(grams(300, -1, 3))
  })

  it('keeps the first pour as long as asked as the bloom', () => {
    expect(pourTimes(5)).toEqual([0, 45, 85, 125, 155])
    expect(pourTimes(5, 55)).toEqual([0, 55, 95, 135, 165])
  })
})

describe('derivePourParams', () => {
  it('reads the balance and pour count back out', () => {
    expect(derivePourParams([{ atS: 0, toG: 70 }, { atS: 40, toG: 120 }, { atS: 75, toG: 180 }, { atS: 100, toG: 240 }, { atS: 130, toG: 300 }]))
      .toEqual({ balance: 0.5, laterPours: 3 })
  })

  it('round-trips build then derive', () => {
    for (const balance of [-1, -0.5, 0, 0.5, 1]) {
      const got = derivePourParams(buildPours(300, balance, 3))
      expect(got.balance).toBeCloseTo(balance, 1)
      expect(got.laterPours).toBe(3)
    }
  })

  it('needs at least three pours', () => {
    expect(() => derivePourParams([{ atS: 0, toG: 100 }, { atS: 40, toG: 200 }])).toThrow()
  })
})
