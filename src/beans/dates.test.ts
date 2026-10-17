import { describe, expect, it } from 'vitest'
import { daysAgo, daysSince, formatDMY, maskDMY, parseDMY, roastAge, roastedLabel, toISODate } from './dates'

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

describe('dd/mm/yyyy entry', () => {
  it('adds the slashes as digits are typed', () => {
    expect(maskDMY('')).toBe('')
    expect(maskDMY('0')).toBe('0')
    expect(maskDMY('05')).toBe('05')
    expect(maskDMY('051')).toBe('05/1')
    expect(maskDMY('0510')).toBe('05/10')
    expect(maskDMY('05102')).toBe('05/10/2')
    expect(maskDMY('05102026')).toBe('05/10/2026')
  })

  it('accepts slashes and other characters the user types, and stops at eight digits', () => {
    expect(maskDMY('05/10/2026')).toBe('05/10/2026')
    expect(maskDMY('05-10-2026')).toBe('05/10/2026')
    expect(maskDMY('0510202699')).toBe('05/10/2026')
    expect(maskDMY('ab1c2')).toBe('12')
  })

  it('lets you backspace over a slash', () => {
    expect(maskDMY('05/')).toBe('05')
    expect(maskDMY('05/1'.slice(0, -1))).toBe('05')
  })

  it('reads day first', () => {
    expect(parseDMY('05/10/2026')).toBe('2026-10-05')
    expect(parseDMY('17/10/2026')).toBe('2026-10-17')
    expect(parseDMY('01/02/2026')).toBe('2026-02-01')
  })

  it('rejects dates that do not exist or are incomplete', () => {
    expect(parseDMY('31/04/2026')).toBeNull()
    expect(parseDMY('29/02/2026')).toBeNull()
    expect(parseDMY('29/02/2024')).toBe('2024-02-29')
    expect(parseDMY('10/13/2026')).toBeNull() // month first is not read as day first
    expect(parseDMY('00/10/2026')).toBeNull()
    expect(parseDMY('05/10/26')).toBeNull()
    expect(parseDMY('05/10')).toBeNull()
    expect(parseDMY('')).toBeNull()
  })

  it('formats an ISO date day first', () => {
    expect(formatDMY('2026-10-05')).toBe('05/10/2026')
    expect(formatDMY(daysAgo(0, today))).toBe('17/10/2026')
  })
})
