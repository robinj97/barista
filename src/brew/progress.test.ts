import { describe, expect, it } from 'vitest'
import type { Pour } from '../../engine/types.ts'
import { currentIndex, phaseAt, pourEndS } from './progress'

// 60 g at 0:00, 120 g at 0:45, 180 g at 1:25: each pour is 60 g, so 15 s of pouring at 4 g/s.
const pours: Pour[] = [{ atS: 0, toG: 60 }, { atS: 45, toG: 120 }, { atS: 85, toG: 180 }]

describe('phaseAt', () => {
  it('starts on the first pour', () => {
    expect(phaseAt(pours, 0)).toEqual({ kind: 'pouring', index: 0 })
    expect(phaseAt(pours, 14)).toEqual({ kind: 'pouring', index: 0 })
  })

  it('waits between pours, then moves on by itself at the scheduled time', () => {
    expect(phaseAt(pours, 15)).toEqual({ kind: 'waiting', index: 0, nextAtS: 45 })
    expect(phaseAt(pours, 44)).toEqual({ kind: 'waiting', index: 0, nextAtS: 45 })
    expect(phaseAt(pours, 45)).toEqual({ kind: 'pouring', index: 1 })
    expect(phaseAt(pours, 85)).toEqual({ kind: 'pouring', index: 2 })
  })

  it('switches to the drawdown when the last pour is over', () => {
    expect(phaseAt(pours, 99)).toEqual({ kind: 'pouring', index: 2 })
    expect(phaseAt(pours, 100)).toEqual({ kind: 'drawdown' })
    expect(phaseAt(pours, 400)).toEqual({ kind: 'drawdown' })
  })

  it('never lets a pour run past the start of the next one', () => {
    const tight: Pour[] = [{ atS: 0, toG: 200 }, { atS: 20, toG: 300 }]
    expect(pourEndS(tight, 0)).toBe(20)
    expect(phaseAt(tight, 20)).toEqual({ kind: 'pouring', index: 1 })
  })

  it('handles a single pour', () => {
    expect(phaseAt([{ atS: 0, toG: 100 }], 10)).toEqual({ kind: 'pouring', index: 0 })
    expect(phaseAt([{ atS: 0, toG: 100 }], 25)).toEqual({ kind: 'drawdown' })
  })
})

describe('currentIndex', () => {
  it('points at the last pour during the drawdown', () => {
    expect(currentIndex({ kind: 'drawdown' }, pours)).toBe(2)
    expect(currentIndex({ kind: 'waiting', index: 1, nextAtS: 85 }, pours)).toBe(1)
  })
})
