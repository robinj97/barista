import { describe, expect, it } from 'vitest'
import recipes from '../data/recipes.json'
import { buildPours, derivePourParams, laterPoursFor } from './pours.ts'
import { suggest } from './suggest.ts'

interface Recorded {
  title: string
  source_url: string
  duplicate_of: string | null
  dose_g: number
  water_g: number
  pours: { at: string; to_g: number }[]
}

/** The hand-collected 4:6 V60 recipes: the engine must be able to reproduce what people actually brew. */
const unique = (recipes as unknown as Recorded[]).filter((r) => r.duplicate_of === null && r.pours.length >= 3)
const pours = (r: Recorded) => r.pours.map((p, i) => ({ atS: i, toG: p.to_g }))

describe('the recorded recipes', () => {
  it('has the six unique recipes we expect', () => {
    expect(unique).toHaveLength(6)
  })

  it.each(unique.map((r) => [r.title, r] as const))('%s: regenerates the same pours from its own balance and pour count', (_title, recipe) => {
    const { balance, laterPours } = derivePourParams(pours(recipe))
    const rebuilt = buildPours(recipe.water_g, balance, laterPours)
    expect(rebuilt).toHaveLength(recipe.pours.length)
    rebuilt.forEach((pour, i) => {
      // Within 2 g: the iced recipe's first phase is 70 g where 40% of 180 g would be 72.
      expect(Math.abs(pour.toG - recipe.pours[i]!.to_g), `pour ${i + 1}`).toBeLessThanOrEqual(2)
    })
  })

  it('covers sweet, bright and balanced first pours, and one to four later pours', () => {
    const params = unique.map((r) => derivePourParams(pours(r)))
    expect(params.some((p) => p.balance <= -0.9)).toBe(true) // tuned for sweetness
    expect(params.some((p) => p.balance >= 0.9)).toBe(true) // tuned for brightness
    expect(new Set(params.map((p) => p.laterPours)).size).toBeGreaterThanOrEqual(3)
  })

  it.each(unique.filter((r) => [2, 3, 4].includes(r.pours.length - 2)).map((r) => [r.title, r] as const))(
    '%s: suggest() reproduces the structure from its balance and strength',
    (_title, recipe) => {
      const { balance, laterPours } = derivePourParams(pours(recipe))
      const strength = (['light', 'medium', 'strong'] as const).find((s) => laterPoursFor(s) === laterPours)!
      const out = suggest({
        method: 'v60',
        bean: { notes: [] },
        target: { balance, strength, emphasise: [] },
        cups: 2,
      })
      expect(out.structure.laterPours).toBe(laterPours)
      expect(out.structure.balance).toBeCloseTo(balance, 1)
      expect(out.recipe.pours).toHaveLength(recipe.pours.length)
    },
  )
})
