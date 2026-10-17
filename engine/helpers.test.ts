import { describe, expect, it } from 'vitest'
import { noteCharacter, noteNudge } from './notes.ts'
import { bloomGap, daysBetween, grindPrior, ratioPrior, targetTime, tempPrior } from './priors.ts'
import { nearestPriors, similarity } from './similarity.ts'
import { processGroup, varietyGroup } from './traits.ts'
import type { BeanTraits, PriorRecipe } from './types.ts'

describe('notes', () => {
  it('knows which way common notes lean', () => {
    expect(noteCharacter('Bergamot')).toBe('bright')
    expect(noteCharacter(' jasmine ')).toBe('bright')
    expect(noteCharacter('caramel')).toBe('sweet')
    expect(noteCharacter('cocoa')).toBe('sweet')
    expect(noteCharacter('tobacco')).toBe('neutral')
  })

  it('reads the words inside a phrase', () => {
    expect(noteCharacter('candied lemon')).toBe('bright')
    expect(noteCharacter('milk chocolate')).toBe('sweet')
    expect(noteCharacter('dark chocolate')).toBe('sweet')
    expect(noteCharacter('orange blossom')).toBe('bright')
    expect(noteCharacter('chocolate orange')).toBe('neutral') // leans both ways
    expect(noteCharacter('toasted bread')).toBe('neutral')
  })

  it('reads compound and plural forms of known notes', () => {
    for (const note of ['blueberry', 'strawberries', 'blackcurrant', 'oranges', 'lemony', 'red fruit']) {
      expect(noteCharacter(note), note).toBe('bright')
    }
    for (const note of ['hazelnut', 'nuts', 'nutty', 'chocolatey', 'caramelised', 'honeyed']) {
      expect(noteCharacter(note), note).toBe('sweet')
    }
    expect(noteCharacter('lemongrass')).toBe('neutral')
  })

  it('turns the notes you want to bring out into a small nudge', () => {
    expect(noteNudge([])).toEqual({ nudge: 0, bright: [], sweet: [] })
    expect(noteNudge(['bergamot']).nudge).toBe(0.35)
    expect(noteNudge(['chocolate']).nudge).toBe(-0.35)
    expect(noteNudge(['bergamot', 'jasmine', 'chocolate']).nudge).toBeCloseTo(0.12, 2)
    expect(noteNudge(['bergamot', 'chocolate']).nudge).toBe(0)
    expect(noteNudge(['petrichor']).nudge).toBe(0)
  })
})

describe('similarity', () => {
  it('groups processes and varieties sensibly', () => {
    expect(processGroup('Washed')).toBe('washed')
    expect(processGroup('Fully washed')).toBe('washed')
    expect(processGroup('Natural')).toBe('natural')
    expect(processGroup('Anaerobic natural')).toBe('anaerobic')
    expect(processGroup('Honey')).toBe('honey')
    expect(processGroup('Pulped natural')).toBe('honey')
    expect(processGroup('Wet-hulled')).toBeNull()
    expect(processGroup(null)).toBeNull()
    expect(varietyGroup('Geisha')).toBe('geisha')
    expect(varietyGroup('Gesha')).toBe('geisha')
    expect(varietyGroup('Pink Bourbon')).toBe('bourbon')
    expect(varietyGroup('SL28')).toBe('sl')
    expect(varietyGroup('Ethiopian Heirloom')).toBe('heirloom')
    expect(varietyGroup('Catuaí')).toBe('bourbon')
    expect(varietyGroup('Caturra')).toBe('bourbon')
    expect(varietyGroup('Typica')).toBe('typica')
    expect(varietyGroup('Wush Wush')).toBeNull()
  })

  const washedEthiopian: BeanTraits = { origin: 'Ethiopia', process: 'Washed', roastLevel: 'light', notes: ['bergamot', 'tangerine'] }

  it('scores a coffee against itself as 1, however much is recorded', () => {
    expect(similarity(washedEthiopian, washedEthiopian)).toBeCloseTo(1, 5)
    expect(similarity({ ...washedEthiopian, altitudeM: 2000, variety: 'Heirloom' }, { ...washedEthiopian, altitudeM: 2100, variety: 'Heirloom' })).toBeCloseTo(1, 5)
  })

  it('does not call two coffees alike on too little shared information', () => {
    const onlyRoast: BeanTraits = { roastLevel: 'light', notes: [] }
    expect(similarity(onlyRoast, onlyRoast)).toBe(0)
    expect(similarity({ origin: 'Kenya', notes: [] }, { origin: 'Kenya', notes: [] })).toBe(0)
  })

  it('compares unlisted processes and varieties on their own text', () => {
    const sumatra: BeanTraits = { origin: 'Indonesia', process: 'Wet-hulled', variety: 'Wush Wush', notes: [] }
    expect(similarity(sumatra, { ...sumatra, process: ' wet-hulled ' })).toBeCloseTo(1, 5)
    expect(similarity(sumatra, { ...sumatra, variety: 'Ateng' })).toBeLessThan(1)
  })

  it('compares notes however they are typed', () => {
    expect(similarity({ ...washedEthiopian, notes: [' Bergamot', 'TANGERINE'] }, washedEthiopian)).toBeCloseTo(1, 5)
  })

  it('compares only what both have', () => {
    const sparse: BeanTraits = { origin: 'Ethiopia', process: 'Washed', roastLevel: 'light', notes: [] }
    expect(similarity(sparse, washedEthiopian)).toBeCloseTo(1, 5)
  })

  it('ranks closer coffees higher', () => {
    const sameButNatural = { ...washedEthiopian, process: 'Natural' }
    const farAway: BeanTraits = { origin: 'Brazil', process: 'Natural', roastLevel: 'dark', notes: ['cocoa'] }
    expect(similarity(washedEthiopian, sameButNatural)).toBeGreaterThan(similarity(washedEthiopian, farAway))
    expect(similarity(washedEthiopian, farAway)).toBe(0)
  })

  it('finds neighbours, never the bean itself', () => {
    const prior = (beanId: string): PriorRecipe => ({ method: 'v60', beanId, bean: washedEthiopian, tempC: 93, grindUm: 800 })
    const found = nearestPriors({ ...washedEthiopian, id: 'me' }, [prior('me'), prior('a')])
    expect(found.map((n) => n.prior.beanId)).toEqual(['a'])
  })
})

describe('priors', () => {
  it('gives each prior a value inside its own range and at least one reason', () => {
    const bean: BeanTraits = { roastLevel: 'medium', process: 'Honey', notes: [] }
    for (const est of [tempPrior(bean), grindPrior(bean, null), ratioPrior(), targetTime(155, 300)]) {
      expect(est.value).toBeGreaterThanOrEqual(est.range[0])
      expect(est.value).toBeLessThanOrEqual(est.range[1])
      expect(est.reasons.length).toBeGreaterThan(0)
    }
  })

  it('scales the finishing time with the size of the brew', () => {
    expect(targetTime(155, 150).value).toBeLessThan(targetTime(155, 300).value)
    expect(targetTime(155, 450).value).toBeGreaterThan(targetTime(155, 300).value)
    expect(targetTime(155, 300).value).toBe(210) // about 3:30 for the reference brew
  })

  it('counts days between dates and refuses things that are not dates', () => {
    expect(daysBetween('2026-10-10', '2026-10-17')).toBe(7)
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3)
    expect(daysBetween('2026-10-17', '2026-10-10')).toBe(-7)
    expect(daysBetween('nope', '2026-10-10')).toBeNull()
    expect(daysBetween('2026-02-31', '2026-03-03')).toBeNull()
    expect(daysBetween('2026-10-17', '2026-13-01')).toBeNull()
  })

  it('only lengthens the bloom for coffee roasted in the last week', () => {
    expect(bloomGap('2026-10-16', '2026-10-17').gapS).toBe(55)
    expect(bloomGap('2026-10-10', '2026-10-17').gapS).toBe(45)
    expect(bloomGap('2026-10-20', '2026-10-17').gapS).toBe(45) // a roast date in the future is ignored
  })
})
