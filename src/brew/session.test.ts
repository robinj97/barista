import { describe, expect, it } from 'vitest'
import { elapsedS, finishSession, startSession } from './session'

const start = () => startSession('bag', 'bag=bag&cups=2', '2026-10-17', 1_000_000)

describe('brew session', () => {
  it('measures time from the wall clock', () => {
    expect(elapsedS(start(), 1_000_000 + 41_400)).toBe(41)
    expect(elapsedS(start(), 900_000)).toBe(0)
  })

  it('finishes with the total time and then ignores further taps', () => {
    const s = finishSession(start(), 1_170_000)
    expect(s.finishedS).toBe(170)
    expect(finishSession(s, 1_999_000).finishedS).toBe(170)
  })
})
