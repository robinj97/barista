import { describe, expect, it } from 'vitest'
import { buildPours } from './pours.ts'
import { MAX_POURS, overriddenKeys, scalePours } from './overrides.ts'
import { suggest } from './suggest.ts'
import { EngineError, type Overrides, type Pour, type SuggestInput } from './types.ts'

const base: SuggestInput = {
  method: 'v60',
  bean: { id: 'b', origin: 'Ethiopia', process: 'Washed', roastLevel: 'light', notes: [] },
  target: { balance: 0, strength: 'medium', emphasise: [] },
  cups: 2,
}
const run = (overrides: Overrides = {}, extra: Partial<SuggestInput> = {}) => suggest({ ...base, ...extra, overrides })
const reasonFor = (out: ReturnType<typeof suggest>, param: string) => out.reasons.filter((r) => r.param === param)

describe('no overrides', () => {
  it('is the plain suggestion, and says nothing was set by hand', () => {
    const out = suggest(base)
    expect(out.overridden).toEqual([])
    expect(run({})).toEqual(out)
    expect(out.reasons.every((r) => r.source !== 'you')).toBe(true)
  })
})

describe('coffee, water and ratio', () => {
  it('keeps the ratio when only the coffee changes: water follows and the pours scale', () => {
    const out = suggest({ ...base, doseG: 15 })
    expect(out.recipe.doseG).toBe(15)
    expect(out.recipe.waterG).toBe(225)
    expect(out.recipe.ratio).toBe(15)
    expect(out.recipe.pours).toEqual(buildPours(225, 0, 3))
    expect(out.overridden).toEqual(['doseG'])
  })

  it('lets a water amount decide the ratio', () => {
    const out = run({ waterG: 280 })
    expect(out.recipe.doseG).toBe(20)
    expect(out.recipe.waterG).toBe(280)
    expect(out.recipe.ratio).toBe(14)
    expect(out.recipe.pours.at(-1)!.toG).toBe(280)
    expect(out.overridden).toEqual(['waterG'])
  })

  it('lets a ratio decide the water when the dose is known', () => {
    const out = run({ ratio: 16 })
    expect(out.recipe.waterG).toBe(320)
    expect(out.recipe.ratio).toBe(16)
    expect(out.overridden).toEqual(['ratio'])
  })

  it('keeps both the coffee and the water when both are set', () => {
    const out = suggest({ ...base, doseG: 15, overrides: { waterG: 300 } })
    expect([out.recipe.doseG, out.recipe.waterG, out.recipe.ratio]).toEqual([15, 300, 20])
    expect(out.overridden).toEqual(['doseG', 'waterG'])
  })

  it('ignores a ratio that is given alongside water, which already decides it', () => {
    const out = run({ waterG: 280, ratio: 17 })
    expect(out.recipe.ratio).toBe(14)
    expect(out.overridden).toEqual(['waterG'])
  })

  it('keeps the shape of the pours (balance and strength) when the water changes', () => {
    const small = suggest({ ...base, doseG: 10, target: { balance: 0.6, strength: 'strong', emphasise: [] } })
    expect(small.recipe.pours).toEqual(buildPours(small.recipe.waterG, 0.6, 4))
  })

  it('says whose numbers they are', () => {
    const reason = reasonFor(suggest({ ...base, doseG: 15, overrides: { waterG: 300 } }), 'dose')[0]!
    expect(reason.source).toBe('you')
    expect(reason.why).toBe('You set the coffee dose and the water.')
    expect(reasonFor(run({ ratio: 16 }), 'ratio')[0]).toMatchObject({ source: 'you', why: 'You set the ratio.' })
    expect(reasonFor(run({ waterG: 280 }), 'ratio')[0]).toMatchObject({ source: 'you', why: 'Worked out from your coffee and water.' })
    expect(reasonFor(suggest(base), 'dose')[0]!.source).toBe('method')
  })
})

describe('temperature, grind and time', () => {
  it('use your value and explain that you set it', () => {
    const out = run({ tempC: 91, grindUm: 700, targetTimeS: 240 })
    expect([out.recipe.tempC, out.recipe.grindUm, out.recipe.targetTimeS]).toEqual([91, 700, 240])
    expect(out.overridden).toEqual(['tempC', 'grindUm', 'targetTimeS'])
    for (const param of ['temp', 'grind', 'time']) {
      expect(reasonFor(out, param).every((r) => r.source === 'you')).toBe(true)
    }
  })

  it('leave the rest of the recipe alone', () => {
    const plain = suggest(base)
    const out = run({ tempC: 91 })
    expect(out.recipe.pours).toEqual(plain.recipe.pours)
    expect(out.recipe.grindUm).toBe(plain.recipe.grindUm)
    expect(out.recipe.doseG).toBe(plain.recipe.doseG)
  })

  it('keep their range around the value, so a value is always inside its range', () => {
    const out = run({ tempC: 80, grindUm: 2000, targetTimeS: 900, ratio: 25 })
    expect(out.ranges.tempC![0]).toBeLessThanOrEqual(80)
    expect(out.ranges.grindUm![1]).toBeGreaterThanOrEqual(2000)
    expect(out.ranges.targetTimeS![1]).toBeGreaterThanOrEqual(900)
    expect(out.ranges.ratio![1]).toBeGreaterThanOrEqual(25)
  })

  it('follow the pours when you do not set the time yourself', () => {
    const short = run({ pours: [{ atS: 0, toG: 100 }, { atS: 30, toG: 300 }] })
    const long = run({ pours: [{ atS: 0, toG: 100 }, { atS: 120, toG: 300 }] })
    expect(long.recipe.targetTimeS).toBeGreaterThan(short.recipe.targetTimeS)
  })
})

describe('custom pours', () => {
  const pours: Pour[] = [{ atS: 0, toG: 50 }, { atS: 40, toG: 110 }, { atS: 80, toG: 200 }]

  it('replace the 4:6 pours, and the water follows their total', () => {
    const out = run({ pours })
    expect(out.recipe.pours).toEqual(pours)
    expect(out.recipe.waterG).toBe(200)
    expect(out.recipe.ratio).toBe(10)
    expect(out.overridden).toEqual(['pours'])
  })

  it('say that balance and strength no longer apply', () => {
    const out = run({ pours })
    const structure = reasonFor(out, 'structure')
    expect(structure).toHaveLength(1)
    expect(structure[0]).toMatchObject({ source: 'you' })
    expect(structure[0]!.what).toBe('Your own pours: 50 g, 60 g, 90 g')
    expect(reasonFor(out, 'balance')).toHaveLength(0)
    expect(reasonFor(out, 'bloom')).toHaveLength(0)
  })

  it('are scaled to a water amount when both are given, keeping their times', () => {
    const out = run({ pours, waterG: 250 })
    expect(out.recipe.waterG).toBe(250)
    expect(out.recipe.pours.map((p) => p.atS)).toEqual([0, 40, 80])
    expect(out.recipe.pours.at(-1)!.toG).toBe(250)
    expect(out.recipe.pours[0]!.toG).toBe(63) // 50 * 250 / 200, rounded
  })

  it('count as one pour for a single pour', () => {
    const out = run({ pours: [{ atS: 0, toG: 300 }] })
    expect(out.recipe.pours).toEqual([{ atS: 0, toG: 300 }])
  })
})

describe('scalePours', () => {
  it('keeps times, ends exactly on the total and never goes backwards', () => {
    const scaled = scalePours([{ atS: 0, toG: 1 }, { atS: 30, toG: 2 }, { atS: 60, toG: 3 }], 30)
    expect(scaled.map((p) => p.atS)).toEqual([0, 30, 60])
    expect(scaled.at(-1)!.toG).toBe(30)
    scaled.forEach((p, i) => i && expect(p.toG).toBeGreaterThan(scaled[i - 1]!.toG))
  })

  it('is the identity at the same total', () => {
    const pours = [{ atS: 0, toG: 60 }, { atS: 45, toG: 120 }, { atS: 90, toG: 300 }]
    expect(scalePours(pours, 300)).toEqual(pours)
  })
})

describe('overriddenKeys', () => {
  it('lists what you set in a fixed order', () => {
    expect(overriddenKeys(true, { targetTimeS: 200, grindUm: 800, tempC: 90, waterG: 300 })).toEqual(['doseG', 'waterG', 'tempC', 'grindUm', 'targetTimeS'])
    expect(overriddenKeys(false)).toEqual([])
  })

  it('skips a ratio that something else already decided', () => {
    expect(overriddenKeys(false, { ratio: 16 })).toEqual(['ratio'])
    expect(overriddenKeys(false, { ratio: 16, waterG: 300 })).toEqual(['waterG'])
    expect(overriddenKeys(false, { ratio: 16, pours: [{ atS: 0, toG: 300 }] })).toEqual(['pours'])
  })
})

describe('validation', () => {
  const bad: [string, Overrides][] = [
    ['water too small', { waterG: 10 }],
    ['water too large', { waterG: 5000 }],
    ['ratio too tight', { ratio: 2 }],
    ['ratio too loose', { ratio: 80 }],
    ['water not a number', { waterG: Number.NaN }],
    ['temperature too hot', { tempC: 120 }],
    ['temperature too cold', { tempC: 20 }],
    ['grind too fine', { grindUm: 50 }],
    ['time too short', { targetTimeS: 5 }],
    ['no pours', { pours: [] }],
    ['first pour not at 0', { pours: [{ atS: 5, toG: 100 }] }],
    ['water going down', { pours: [{ atS: 0, toG: 100 }, { atS: 30, toG: 90 }] }],
    ['times out of order', { pours: [{ atS: 0, toG: 100 }, { atS: 30, toG: 150 }, { atS: 20, toG: 200 }] }],
    ['a pour with no amount', { pours: [{ atS: 0, toG: 0 }] }],
    ['too many pours', { pours: Array.from({ length: MAX_POURS + 1 }, (_, i) => ({ atS: i * 30, toG: (i + 1) * 20 })) }],
  ]

  it.each(bad)('refuses %s', (_name, overrides) => {
    expect(() => run(overrides)).toThrow(EngineError)
  })

  it('refuses a dose that makes no sense', () => {
    expect(() => suggest({ ...base, doseG: 3 })).toThrow(EngineError)
  })

  it('accepts the edges', () => {
    expect(() => run({ waterG: 30, tempC: 50, grindUm: 100, targetTimeS: 30 })).not.toThrow()
    expect(() => run({ waterG: 1500, tempC: 100, grindUm: 3000, targetTimeS: 1800, ratio: 8 })).not.toThrow()
  })
})

describe('invariants with overrides', () => {
  const cases: [SuggestInput['doseG'], Overrides][] = []
  for (const dose of [undefined, 8, 15, 30])
    for (const waterG of [undefined, 150, 260, 600])
      for (const ratio of [undefined, 12, 17])
        for (const tempC of [undefined, 85, 99])
          cases.push([dose, { waterG, ratio, tempC }])

  it('always gives a coherent, explained recipe, and records every override', () => {
    for (const [doseG, overrides] of cases) {
      const out = suggest({ ...base, doseG, overrides })
      const { recipe } = out
      expect(recipe.pours.at(-1)!.toG).toBe(recipe.waterG)
      recipe.pours.forEach((pour, i) => i && expect(pour.toG).toBeGreaterThan(recipe.pours[i - 1]!.toG))
      expect(Math.abs(recipe.waterG / recipe.doseG - recipe.ratio)).toBeLessThan(0.06)
      expect(recipe.tempC).toBeGreaterThanOrEqual(out.ranges.tempC![0])
      expect(recipe.tempC).toBeLessThanOrEqual(out.ranges.tempC![1])
      expect(recipe.ratio).toBeGreaterThanOrEqual(out.ranges.ratio![0])
      expect(recipe.ratio).toBeLessThanOrEqual(out.ranges.ratio![1])
      if (doseG !== undefined) expect(out.overridden).toContain('doseG')
      if (overrides.tempC !== undefined) expect(reasonFor(out, 'temp')[0]!.source).toBe('you')
      for (const key of out.overridden) expect(['doseG', 'waterG', 'ratio', 'pours', 'tempC', 'grindUm', 'targetTimeS']).toContain(key)
    }
  })

  it('is deterministic and leaves its input alone', () => {
    const input = Object.freeze({ ...base, doseG: 15, overrides: Object.freeze({ waterG: 260, tempC: 91 }) })
    expect(suggest(input)).toEqual(suggest(input))
  })
})
