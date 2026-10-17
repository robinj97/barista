import { describe, expect, it } from 'vitest'
import type { Bag } from '../data/types'
import { afterBrew, afterLock, isEmpty } from './bagUsage'

const bag = (extra: Partial<Bag> = {}): Bag => ({
  id: 'bag',
  bean: { id: 'b', roaster: 'R', name: 'N', origin: null, region: null, producer: null, variety: null, process: null, altitudeM: null, roastLevel: null, roasterNotes: [] },
  roastDate: null,
  gramsRemaining: 250,
  status: 'new',
  createdAt: '2026-10-10T10:00:00Z',
  ...extra,
})

describe('afterBrew', () => {
  it('uses up the coffee and moves a new bag to dialing in', () => {
    expect(afterBrew(bag(), 20)).toEqual({ gramsRemaining: 230, status: 'dialing_in' })
  })

  it('keeps a bag that is already dialing in or locked where it is', () => {
    expect(afterBrew(bag({ status: 'dialing_in' }), 18.5)).toEqual({ gramsRemaining: 231.5 })
    expect(afterBrew(bag({ status: 'locked' }), 20)).toEqual({ gramsRemaining: 230 })
  })

  it('never goes below zero', () => {
    expect(afterBrew(bag({ gramsRemaining: 12 }), 20)).toEqual({ gramsRemaining: 0, status: 'dialing_in' })
  })

  it('leaves the amount alone when you never said how much was in the bag', () => {
    expect(afterBrew(bag({ gramsRemaining: null }), 20)).toEqual({ status: 'dialing_in' })
  })
})

describe('afterLock', () => {
  it('locks the bag once, and only changes what is needed', () => {
    expect(afterLock(bag({ status: 'dialing_in' }))).toEqual({ status: 'locked' })
    expect(isEmpty(afterLock(bag({ status: 'locked' })))).toBe(true)
  })
})
