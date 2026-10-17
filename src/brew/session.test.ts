import { describe, expect, it } from 'vitest'
import { currentPour, elapsedS, finishSession, startSession, tickPour } from './session'

const start = () => startSession('bag', 'bag=bag&cups=2', '2026-10-17', 1_000_000)

describe('brew session', () => {
  it('measures time from the wall clock', () => {
    expect(elapsedS(start(), 1_000_000 + 41_400)).toBe(41)
    expect(elapsedS(start(), 900_000)).toBe(0)
  })

  it('ticks pours off in order and stops at the last one', () => {
    let s = start()
    s = tickPour(s, 1_000_000 + 30_000, 2)
    s = tickPour(s, 1_000_000 + 75_000, 2)
    expect(s.ticksS).toEqual([30, 75])
    expect(tickPour(s, 1_000_000 + 90_000, 2).ticksS).toEqual([30, 75])
    expect(currentPour(s, 2)).toBeNull()
    expect(currentPour(tickPour(start(), 1_001_000, 2), 2)).toBe(1)
  })

  it('cannot finish before the last pour is ticked off', () => {
    const s = tickPour(start(), 1_030_000, 2)
    expect(finishSession(s, 1_150_000, 2).finishedS).toBeNull()
  })

  it('finishes with the drawdown time and then ignores further taps', () => {
    let s = tickPour(tickPour(start(), 1_030_000, 2), 1_075_000, 2)
    s = finishSession(s, 1_170_000, 2)
    expect(s.finishedS).toBe(170)
    expect(finishSession(s, 1_999_000, 2).finishedS).toBe(170)
    expect(tickPour(s, 1_999_000, 3).ticksS).toHaveLength(2)
  })
})
