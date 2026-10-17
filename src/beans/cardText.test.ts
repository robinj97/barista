import { describe, expect, it } from 'vitest'
import type { Bag, Bean } from '../data/types'
import { eyebrow, matchesSearch, visibleNotes } from './cardText'

const bean = (overrides: Partial<Bean> = {}): Bean => ({
  id: 'b',
  roaster: 'Placeholder Roasters',
  name: 'Tanzania Geisha',
  origin: 'Tanzania',
  region: 'Arusha',
  producer: null,
  variety: 'Geisha',
  process: 'Washed',
  altitudeM: null,
  roastLevel: 'light',
  roasterNotes: ['black tea', 'candied lemon', 'vanilla'],
  ...overrides,
})
const bag = (b: Bean): Bag => ({ id: 'bag', bean: b, roastDate: null, gramsRemaining: null, status: 'new', createdAt: '' })

describe('eyebrow', () => {
  it('leads with the variety and then the process', () => {
    expect(eyebrow(bean())).toBe('Geisha · Washed')
  })

  it('falls back to the origin when there is no variety', () => {
    expect(eyebrow(bean({ variety: null }))).toBe('Tanzania · Washed')
    expect(eyebrow(bean({ variety: '  ' }))).toBe('Tanzania · Washed')
  })

  it('shows whatever exists, or nothing', () => {
    expect(eyebrow(bean({ process: null }))).toBe('Geisha')
    expect(eyebrow(bean({ variety: null, origin: null }))).toBe('Washed')
    expect(eyebrow(bean({ variety: null, origin: null, process: null }))).toBeNull()
  })
})

describe('visibleNotes', () => {
  it('shows the first three and counts the rest', () => {
    expect(visibleNotes(['a', 'b', 'c', 'd', 'e'])).toEqual({ shown: ['a', 'b', 'c'], extra: 2 })
  })

  it('shows all of a short list', () => {
    expect(visibleNotes(['a', 'b'])).toEqual({ shown: ['a', 'b'], extra: 0 })
    expect(visibleNotes([])).toEqual({ shown: [], extra: 0 })
  })
})

describe('matchesSearch', () => {
  const geisha = bag(bean())

  it('matches everything when empty', () => {
    expect(matchesSearch(geisha, '')).toBe(true)
    expect(matchesSearch(geisha, '   ')).toBe(true)
  })

  it('finds a variety, a process, a note, the name, the roaster and the origin', () => {
    for (const query of ['geisha', 'WASHED', 'vanilla', 'candied', 'tanzania', 'placeholder', 'arusha']) {
      expect(matchesSearch(geisha, query), query).toBe(true)
    }
  })

  it('needs every word to match, in any order', () => {
    expect(matchesSearch(geisha, 'washed vanilla')).toBe(true)
    expect(matchesSearch(geisha, 'vanilla washed')).toBe(true)
    expect(matchesSearch(geisha, 'washed jasmine')).toBe(false)
  })

  it('does not match unrelated words', () => {
    expect(matchesSearch(geisha, 'natural')).toBe(false)
    expect(matchesSearch(bag(bean({ variety: null, name: 'Guji', roasterNotes: [] })), 'geisha')).toBe(false)
  })
})
