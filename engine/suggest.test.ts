import { describe, expect, it } from 'vitest'
import { suggest, supportsMethod } from './suggest.ts'
import { EngineError, type PriorRecipe, type SuggestInput } from './types.ts'

const base: SuggestInput = {
  method: 'v60',
  bean: {
    id: 'elto',
    origin: 'Ethiopia',
    process: 'Washed',
    roastLevel: 'light',
    notes: ['bergamot', 'tangerine'],
  },
  target: { balance: 0, strength: 'medium', emphasise: [] },
  cups: 2,
}

const withBean = (bean: Partial<SuggestInput['bean']>, rest: Partial<SuggestInput> = {}): SuggestInput => ({
  ...base,
  ...rest,
  bean: { ...base.bean, ...bean },
})

const prior = (overrides: Partial<PriorRecipe> = {}): PriorRecipe => ({
  source: 'own',
  method: 'v60',
  beanId: 'elto',
  bean: base.bean,
  tempC: 93,
  grindUm: 800,
  ratio: 15,
  ...overrides,
})

describe('the reference recipe', () => {
  const out = suggest(base)

  it('is 20 g in 300 g with the 60, 120, 180, 240, 300 pour schedule', () => {
    expect(out.recipe.doseG).toBe(20)
    expect(out.recipe.waterG).toBe(300)
    expect(out.recipe.ratio).toBe(15)
    expect(out.recipe.pours.map((p) => p.toG)).toEqual([60, 120, 180, 240, 300])
    expect(out.structure).toEqual({ balance: 0, laterPours: 3 })
  })

  it('has no agitation and echoes no filter when none is set', () => {
    expect(out.recipe.agitation).toBeNull()
    expect(out.recipe.filter).toBeNull()
  })

  it('defaults to low confidence and says what to expect', () => {
    expect(out.confidence.level).toBe('low')
    expect(out.confidence.basis).toMatch(/two or three brews/)
  })
})

describe('dose, cups and strength', () => {
  it('scales dose and water with the cups and keeps the ratio', () => {
    const [one, two, three] = [1, 2, 3].map((cups) => suggest({ ...base, cups }))
    expect([one!.recipe.doseG, two!.recipe.doseG, three!.recipe.doseG]).toEqual([10, 20, 30])
    expect([one!.recipe.waterG, two!.recipe.waterG, three!.recipe.waterG]).toEqual([150, 300, 450])
    expect(new Set([one, two, three].map((o) => o!.recipe.ratio)).size).toBe(1)
  })

  it('uses an exact dose when given', () => {
    expect(suggest({ ...base, doseG: 18 }).recipe.doseG).toBe(18)
  })

  it('refuses doses that make no sense', () => {
    for (const doseG of [0, 4, 61, Number.NaN]) {
      expect(() => suggest({ ...base, doseG })).toThrow(EngineError)
    }
    expect(() => suggest({ ...base, cups: 0 })).toThrow(EngineError)
  })

  it('tightens the ratio and adds pours for a stronger cup', () => {
    const light = suggest({ ...base, target: { ...base.target, strength: 'light' } })
    const strong = suggest({ ...base, target: { ...base.target, strength: 'strong' } })
    expect(light.recipe.ratio).toBeGreaterThan(strong.recipe.ratio)
    expect(light.structure.laterPours).toBeLessThan(strong.structure.laterPours)
    expect(light.recipe.pours.length).toBeLessThan(strong.recipe.pours.length)
  })
})

describe('methods', () => {
  it('only supports V60 for now', () => {
    expect(supportsMethod('v60')).toBe(true)
    expect(supportsMethod('aeropress')).toBe(false)
    expect(supportsMethod('espresso')).toBe(false)
  })

  it('says so instead of guessing for other methods', () => {
    for (const method of ['aeropress', 'espresso'] as const) {
      try {
        suggest({ ...base, method })
        expect.unreachable()
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError)
        expect((error as EngineError).code).toBe('unsupported_method')
      }
    }
  })
})

describe('temperature', () => {
  const temp = (bean: Partial<SuggestInput['bean']>) => suggest(withBean(bean)).recipe.tempC

  it('follows roast level: hotter for lighter roasts', () => {
    expect(temp({ roastLevel: 'light', process: 'Honey' })).toBe(94)
    expect(temp({ roastLevel: 'medium', process: 'Honey' })).toBe(90)
    expect(temp({ roastLevel: 'dark', process: 'Honey' })).toBe(85)
  })

  it('nudges one degree for process', () => {
    expect(temp({ roastLevel: 'light', process: 'Washed' })).toBe(95)
    expect(temp({ roastLevel: 'light', process: 'Natural' })).toBe(93)
    expect(temp({ roastLevel: 'light', process: 'Anaerobic natural' })).toBe(93)
  })

  it('assumes a light roast, and says so, when the roast level is unknown', () => {
    const out = suggest(withBean({ roastLevel: null, process: 'Honey' }))
    expect(out.recipe.tempC).toBe(94)
    expect(out.reasons.some((r) => r.param === 'temp' && r.source === 'assumption')).toBe(true)
  })
})

describe('grind and filter', () => {
  const grind = (filter: SuggestInput['filter'], bean: Partial<SuggestInput['bean']> = {}) =>
    suggest({ ...withBean(bean), filter })

  it('starts coarse and gets coarser for darker roasts', () => {
    expect(grind(null, { roastLevel: 'light' }).recipe.grindUm).toBe(820)
    expect(grind(null, { roastLevel: 'medium' }).recipe.grindUm).toBe(850)
    expect(grind(null, { roastLevel: 'dark' }).recipe.grindUm).toBe(880)
  })

  it('goes a little finer for fast papers and coarser for slow ones', () => {
    const fast = grind({ id: 'f', brand: 'CAFEC', model: 'T-90', flowClass: 'fast' })
    const slow = grind({ id: 's', brand: 'X', model: 'Slow', flowClass: 'slow' })
    expect(fast.recipe.grindUm).toBe(790)
    expect(slow.recipe.grindUm).toBe(850)
    expect(fast.reasons.some((r) => r.param === 'filter' && r.source === 'guidance')).toBe(true)
  })

  it('does not adjust when the paper is unknown, and says why', () => {
    const out = grind({ id: 'f', brand: 'Hario', model: 'V60', flowClass: null })
    expect(out.recipe.grindUm).toBe(820)
    expect(out.recipe.filter?.model).toBe('V60')
    expect(out.reasons.find((r) => r.param === 'filter')?.source).toBe('assumption')
  })
})

describe('tasting notes', () => {
  const run = (emphasise: string[], balance = 0) =>
    suggest({ ...base, target: { balance, strength: 'medium', emphasise } })

  it('lean brighter for bright notes and sweeter for sweet notes', () => {
    expect(run(['bergamot', 'jasmine']).structure.balance).toBeGreaterThan(0)
    expect(run(['chocolate']).structure.balance).toBeLessThan(0)
    expect(run(['bergamot', 'chocolate']).structure.balance).toBe(0)
  })

  it('make the first pour bigger or smaller accordingly', () => {
    const neutral = run([]).recipe.pours[0]!.toG
    expect(run(['bergamot']).recipe.pours[0]!.toG).toBeGreaterThan(neutral)
    expect(run(['chocolate']).recipe.pours[0]!.toG).toBeLessThan(neutral)
  })

  it('only nudge, so the balance setting still leads', () => {
    expect(run(['chocolate'], 0.6).structure.balance).toBeGreaterThan(0)
    expect(Math.abs(run(['bergamot']).structure.balance)).toBeLessThanOrEqual(0.35)
  })

  it('ignore notes they do not know, with no reason added', () => {
    const out = run(['petrichor'])
    expect(out.structure.balance).toBe(0)
    expect(out.reasons.some((r) => r.param === 'balance')).toBe(false)
  })

  it('explain a nudge, and a balance kept in range', () => {
    expect(run(['bergamot']).reasons.some((r) => r.param === 'balance')).toBe(true)
    const clamped = run([], 3)
    expect(clamped.structure.balance).toBe(1)
    expect(clamped.reasons.some((r) => r.param === 'balance')).toBe(true)
  })
})

describe('roast freshness', () => {
  const gap = (roastDate: string | null, asOf?: string) =>
    suggest(withBean({ roastDate }, { asOf })).recipe.pours[1]!.atS

  it('gives fresh coffee a longer bloom', () => {
    expect(gap('2026-10-15', '2026-10-17')).toBe(55)
    expect(gap('2026-10-17', '2026-10-17')).toBe(55)
  })

  it('leaves older coffee alone', () => {
    expect(gap('2026-10-01', '2026-10-17')).toBe(45)
  })

  it('ignores freshness when it cannot tell what day it is', () => {
    expect(gap('2026-10-15')).toBe(45)
    expect(gap(null, '2026-10-17')).toBe(45)
    expect(gap('nonsense', '2026-10-17')).toBe(45)
  })

  it('explains the longer bloom', () => {
    const out = suggest(withBean({ roastDate: '2026-10-15' }, { asOf: '2026-10-17' }))
    expect(out.reasons.some((r) => r.param === 'bloom')).toBe(true)
  })
})

describe('learning from recipes', () => {
  it('starts from your own locked recipe for the same bean, with high confidence', () => {
    const out = suggest({ ...base, context: { own: [prior({ tempC: 92, grindUm: 780 })], friends: [] } })
    expect(out.recipe.tempC).toBe(92)
    expect(out.recipe.grindUm).toBe(780)
    expect(out.confidence.level).toBe('high')
    expect(out.reasons.some((r) => r.param === 'temp' && r.source === 'data')).toBe(true)
  })

  it('uses a friend\'s locked recipe with medium confidence', () => {
    const out = suggest({ ...base, context: { own: [], friends: [prior({ source: 'friend', tempC: 94, grindUm: 810 })] } })
    expect(out.recipe.tempC).toBe(94)
    expect(out.recipe.grindUm).toBe(810)
    expect(out.confidence.level).toBe('medium')
    expect(out.confidence.basis).toMatch(/friend/)
  })

  it('prefers your own recipe over a friend\'s', () => {
    const out = suggest({
      ...base,
      context: { own: [prior({ tempC: 91 })], friends: [prior({ source: 'friend', tempC: 95 })] },
    })
    expect(out.recipe.tempC).toBe(91)
    expect(out.confidence.level).toBe('high')
  })

  it('takes the middle of several friends', () => {
    const friends = [90, 94, 96].map((tempC) => prior({ source: 'friend', tempC }))
    expect(suggest({ ...base, context: { own: [], friends } }).recipe.tempC).toBe(94)
  })

  it('still builds the pours and ratio from your own dials', () => {
    const out = suggest({
      ...base,
      target: { balance: 1, strength: 'strong', emphasise: [] },
      context: { own: [prior({ ratio: 17 })], friends: [] },
    })
    expect(out.structure).toEqual({ balance: 1, laterPours: 4 })
    expect(out.recipe.ratio).toBe(14)
  })

  it('ignores recipes for other methods', () => {
    const out = suggest({ ...base, context: { own: [prior({ method: 'espresso' })], friends: [] } })
    expect(out.confidence.level).toBe('low')
    expect(out.recipe.tempC).toBe(95)
  })

  it('keeps the data range tight around the borrowed value', () => {
    const out = suggest({ ...base, context: { own: [prior({ tempC: 92 })], friends: [] } })
    expect(out.ranges.tempC).toEqual([91, 93])
    expect(out.ranges.grindUm).toEqual([760, 840])
  })
})

describe('learning from similar beans', () => {
  const similar = (id: string, tempC: number, grindUm: number): PriorRecipe =>
    prior({
      source: 'friend',
      beanId: id,
      bean: { origin: 'Ethiopia', process: 'Washed', roastLevel: 'light', notes: ['bergamot'] },
      tempC,
      grindUm,
    })

  it('does not rely on one or two similar coffees', () => {
    const out = suggest({ ...base, context: { own: [], friends: [similar('a', 90, 700)] } })
    expect(out.confidence.level).toBe('low')
    expect(out.confidence.basis).toMatch(/too few/)
    expect(out.recipe.tempC).toBeLessThan(95)
    expect(out.recipe.tempC).toBeGreaterThan(90)
  })

  it('blends towards three or more and raises confidence to medium', () => {
    const friends = [similar('a', 91, 780), similar('b', 91, 780), similar('c', 91, 780)]
    const out = suggest({ ...base, context: { own: [], friends } })
    expect(out.confidence.level).toBe('medium')
    expect(out.recipe.tempC).toBeLessThan(95)
    expect(out.recipe.tempC).toBeGreaterThanOrEqual(93)
    expect(out.recipe.grindUm).toBeLessThan(820)
  })

  it('never lets neighbours override the guidance entirely', () => {
    const friends = Array.from({ length: 8 }, (_, i) => similar(`n${i}`, 80, 400))
    const out = suggest({ ...base, context: { own: [], friends } })
    expect(out.recipe.tempC).toBeGreaterThan(88) // at most 40% of the way to 80
    expect(out.recipe.grindUm).toBeGreaterThan(600)
  })

  it('ignores coffees that are not alike', () => {
    const different = prior({
      source: 'friend',
      beanId: 'z',
      bean: { origin: 'Brazil', process: 'Natural', roastLevel: 'dark', notes: ['cocoa'] },
      tempC: 80,
      grindUm: 500,
    })
    const out = suggest({ ...base, context: { own: [], friends: [different, different, different] } })
    expect(out.confidence.level).toBe('low')
    expect(out.recipe.tempC).toBe(95)
  })
})

describe('invariants over many inputs', () => {
  const cases: SuggestInput[] = []
  for (const cups of [1, 2, 3, 4])
    for (const strength of ['light', 'medium', 'strong'] as const)
      for (const balance of [-1, -0.3, 0, 0.7, 1])
        for (const roastLevel of ['light', 'medium', 'dark', null] as const)
          for (const process of ['Washed', 'Natural', null])
            cases.push(withBean({ roastLevel, process }, { cups, target: { balance, strength, emphasise: ['bergamot'] } }))

  it('always gives a valid, explained recipe', () => {
    for (const input of cases) {
      const { recipe, ranges, reasons, confidence } = suggest(input)
      expect(recipe.pours.at(-1)!.toG).toBe(recipe.waterG)
      recipe.pours.forEach((pour, i) => {
        expect(pour.toG).toBeGreaterThan(i ? recipe.pours[i - 1]!.toG : 0)
      })
      expect(Math.abs(recipe.waterG / recipe.doseG - recipe.ratio)).toBeLessThan(0.06)
      expect(recipe.tempC).toBeGreaterThanOrEqual(ranges.tempC![0])
      expect(recipe.tempC).toBeLessThanOrEqual(ranges.tempC![1])
      expect(recipe.grindUm).toBeGreaterThanOrEqual(ranges.grindUm![0])
      expect(recipe.grindUm).toBeLessThanOrEqual(ranges.grindUm![1])
      expect(recipe.targetTimeS).toBeGreaterThan(recipe.pours.at(-1)!.atS)
      for (const param of ['structure', 'dose', 'temp', 'grind', 'ratio', 'time'] as const) {
        expect(reasons.some((r) => r.param === param), param).toBe(true)
      }
      for (const reason of reasons) {
        expect(reason.what.length).toBeGreaterThan(0)
        expect(reason.why.length).toBeGreaterThan(0)
      }
      expect(['low', 'medium', 'high']).toContain(confidence.level)
    }
  })

  it('is deterministic and does not touch its input', () => {
    const input = Object.freeze(
      withBean({}, { context: { own: [prior()], friends: [] }, target: { balance: 0.2, strength: 'medium', emphasise: ['bergamot'] } }),
    )
    expect(suggest(input)).toEqual(suggest(input))
  })
})
