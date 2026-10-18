import { describe, expect, it } from 'vitest'
import type { Draft } from '../data/types'
import { DEFAULT_DOSE_G, stockOf, stockText, usualDoseG } from './stock'

const choices = { bagId: 'b', balance: 0, strength: 'medium', grinderId: null, filterId: null, cups: 2, edits: {} } as const
const draft = (extra: Partial<Draft> = {}): Draft => ({ beanId: 'x', method: 'v60', choices: { ...choices }, lastBrew: null, updatedAt: '2026-10-17T10:00:00Z', ...extra })

describe('stockOf', () => {
  it('says running low under three doses, and how many brews are left', () => {
    expect(stockOf({ gramsRemaining: 50 }, 20)).toEqual({ state: 'low', brewsLeft: 2 })
    expect(stockOf({ gramsRemaining: 59 }, 20)).toEqual({ state: 'low', brewsLeft: 2 })
    expect(stockOf({ gramsRemaining: 60 }, 20)).toBeNull()
    expect(stockOf({ gramsRemaining: 15 }, 20)).toEqual({ state: 'low', brewsLeft: 0 })
  })

  it('adapts to your usual dose', () => {
    expect(stockOf({ gramsRemaining: 50 }, 15)).toBeNull()
    expect(stockOf({ gramsRemaining: 50 }, 18)).toEqual({ state: 'low', brewsLeft: 2 })
  })

  it('says empty at zero, and nothing when the amount is unknown or the bag is finished', () => {
    expect(stockOf({ gramsRemaining: 0 }, 20)).toEqual({ state: 'empty' })
    expect(stockOf({ gramsRemaining: null }, 20)).toBeNull()
    expect(stockOf({ gramsRemaining: 10, finishedAt: '2026-10-17T10:00:00Z' }, 20)).toBeNull()
  })
})

describe('stockText', () => {
  it('puts it in words', () => {
    expect(stockText({ state: 'empty' })).toBe('Empty')
    expect(stockText({ state: 'low', brewsLeft: 2 })).toBe('Running low · about 2 brews left')
    expect(stockText({ state: 'low', brewsLeft: 1 })).toBe('Running low · about 1 brew left')
    expect(stockText({ state: 'low', brewsLeft: 0 })).toBe('Running low · less than one brew left')
  })
})

describe('usualDoseG', () => {
  it('uses the last brew, else the working recipe, else 20 g', () => {
    const recipe = { doseG: 18, waterG: 270, ratio: 15, tempC: 94, grindUm: 780, targetTimeS: 180, pours: [] }
    const lastBrew = { brewedAt: '', totalTimeS: null, tastes: [], improve: [], compared: null, yieldG: null, notes: '', firstPourG: 50, recipe }
    expect(usualDoseG('x', [draft({ lastBrew })])).toBe(18)
    expect(usualDoseG('x', [draft({ choices: { ...choices, edits: { doseG: 16 } } })])).toBe(16)
    expect(usualDoseG('x', [draft({ choices: { ...choices, cups: 1 } })])).toBe(10)
    expect(usualDoseG('x', [])).toBe(DEFAULT_DOSE_G)
    expect(usualDoseG('other', [draft()])).toBe(DEFAULT_DOSE_G)
  })
})
