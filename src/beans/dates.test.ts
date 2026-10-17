import { describe, expect, it } from 'vitest'
import { daysAgo, daysSince, roastAge, roastedLabel, toISODate } from './dates'

const today = new Date(2026, 9, 17, 14, 30) // 17 Oct 2026, mid-afternoon

describe('dates', () => {
  it('formats local dates', () => {
    expect(toISODate(today)).toBe('2026-10-17')
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('counts back across month and year boundaries', () => {
    expect(daysAgo(0, today)).toBe('2026-10-17')
    expect(daysAgo(7, today)).toBe('2026-10-10')
    expect(daysAgo(20, today)).toBe('2026-09-27')
    expect(daysAgo(20, new Date(2026, 0, 5))).toBe('2025-12-16')
  })

  it('counts days between a roast date and today, ignoring the time of day', () => {
    expect(daysSince('2026-10-17', today)).toBe(0)
    expect(daysSince('2026-10-10', today)).toBe(7)
    expect(daysSince('2026-10-10', new Date(2026, 9, 17, 0, 1))).toBe(7)
    expect(daysSince('2026-10-10', new Date(2026, 9, 17, 23, 59))).toBe(7)
  })

  it('describes freshness in plain words', () => {
    expect(roastedLabel(null, today)).toBeNull()
    expect(roastedLabel('2026-10-17', today)).toBe('Roasted today')
    expect(roastedLabel('2026-10-16', today)).toBe('Roasted yesterday')
    expect(roastedLabel('2026-10-12', today)).toBe('Roasted 5 days ago')
    expect(roastedLabel('2026-09-26', today)).toBe('Roasted 3 weeks ago')
    expect(roastedLabel('2026-06-17', today)).toBe('Roasted 4 months ago')
    expect(roastAge('2026-10-12', today)).toBe('5 days ago')
    expect(roastAge(null, today)).toBeNull()
  })
})
