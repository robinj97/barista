import { describe, expect, it } from 'vitest'
import { dedupeKey, similarity } from './dedupe'

describe('dedupeKey', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(dedupeKey('Café Sey', 'Gatomboya AA')).toBe(dedupeKey('cafe  sey', 'GATOMBOYA-AA'))
  })

  it('ignores filler words in the roaster, but not in the name', () => {
    expect(dedupeKey('Rogue Wave', 'Elto')).toBe(dedupeKey('Rogue Wave Coffee Roasters', 'Elto'))
    expect(dedupeKey('The Sey Coffee Co.', 'Elto')).toBe(dedupeKey('Sey', 'Elto'))
    expect(dedupeKey('Sey', 'Colombia Coffee')).not.toBe(dedupeKey('Sey', 'Colombia'))
  })

  it('tells different beans apart', () => {
    expect(dedupeKey('Sey', 'Gatomboya AA')).not.toBe(dedupeKey('Sey', 'Gatomboya AB'))
  })
})

describe('similarity', () => {
  it('is 1 for the same key and low for unrelated ones', () => {
    expect(similarity('abc', 'abc')).toBe(1)
    expect(similarity(dedupeKey('Sey', 'Something Else'), dedupeKey('Qqq', 'Another'))).toBeLessThan(0.3)
  })

  it('is high when a lot number is added', () => {
    expect(similarity(dedupeKey('Zyx', 'Dukorere Natural'), dedupeKey('Zyx', 'Dukorere Natural Lot 33'))).toBeGreaterThanOrEqual(0.6)
  })
})
