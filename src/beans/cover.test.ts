import { describe, expect, it } from 'vitest'
import { beanCover } from './cover'

describe('beanCover', () => {
  it('is stable for the same id', () => {
    expect(beanCover('abc')).toEqual(beanCover('abc'))
  })

  it('spreads different ids across tints and shapes', () => {
    const covers = Array.from({ length: 60 }, (_, i) => beanCover(`bean-${i}`))
    expect(new Set(covers.map((c) => c.tint)).size).toBe(4)
    expect(new Set(covers.map((c) => c.pebble)).size).toBe(3)
  })
})
