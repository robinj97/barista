import { describe, expect, it } from 'vitest'
import { cToF, formatTemp, fromDisplayTemp, fToC, toDisplayTemp } from './units.ts'

describe('temperature units', () => {
  it('converts at the fixed points', () => {
    expect(cToF(0)).toBe(32)
    expect(cToF(100)).toBe(212)
    expect(fToC(212)).toBe(100)
    expect(fToC(32)).toBe(0)
  })

  it('shows whole degrees in F and half degrees in C', () => {
    expect(toDisplayTemp(96, 'f')).toBe(205)
    expect(toDisplayTemp(93.3, 'c')).toBe(93.5)
    expect(toDisplayTemp(93, 'c')).toBe(93)
  })

  it('formats with the unit', () => {
    expect(formatTemp(96, 'c')).toBe('96°C')
    expect(formatTemp(96, 'f')).toBe('205°F')
  })

  it('round-trips a typical brewing temperature through the display unit', () => {
    for (const celsius of [88, 90, 92, 93, 94, 95, 96]) {
      const back = fromDisplayTemp(toDisplayTemp(celsius, 'f'), 'f')
      expect(Math.abs(back - celsius)).toBeLessThanOrEqual(0.3)
    }
    expect(fromDisplayTemp(94, 'c')).toBe(94)
  })
})
