import { describe, expect, it } from 'vitest'
import { elapsedS, finishSession, startSession, untimedSession } from './session'

const start = () => startSession('bag', 'bag=bag&cups=2', '2026-10-17', 1_000_000)

describe('brew session', () => {
  it('measures time from the wall clock', () => {
    expect(elapsedS(start(), 1_000_000 + 41_400)).toBe(41)
    expect(elapsedS(start(), 1_000_000 + 44_999)).toBe(44) // the clock reaches 0:45 exactly at 45 s, not half a second early
    expect(elapsedS(start(), 900_000)).toBe(0)
  })

  it('finishes with the total time and then ignores further taps', () => {
    const s = finishSession(start(), 1_170_000)
    expect(s.finishedS).toBe(170)
    expect(finishSession(s, 1_999_000).finishedS).toBe(170)
  })

  it('can be finished without a timer, with no total time to record', () => {
    const s = untimedSession('bag', 'bag=bag', '2026-10-17', 1_000_000)
    expect(s.finishedS).toBe(0)
    expect(s.untimed).toBe(true)
  })

  it('keeps the numbers brewed, timed or not, so the log shows exactly them', () => {
    const recipe = { doseG: 20, waterG: 300, ratio: 15, tempC: 94, grindUm: 780, targetTimeS: 190, pours: [] }
    expect(untimedSession('bag', 'bag=bag', '2026-10-17', 1_000_000, recipe).recipe).toEqual(recipe)
    expect(startSession('bag', 'bag=bag', '2026-10-17', 1_000_000, recipe).recipe).toEqual(recipe)
  })
})
