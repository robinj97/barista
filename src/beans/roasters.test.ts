import { describe, expect, it } from 'vitest'
import { splitKnownRoaster, uniqueRoasters } from './roasters'

const roasters = ['Coffea Circulor', "Father's", 'Coffea']

describe('splitKnownRoaster', () => {
  it('treats an exact roaster as the roaster alone', () => {
    expect(splitKnownRoaster('Coffea Circulor', roasters)).toEqual({ roaster: 'Coffea Circulor' })
    expect(splitKnownRoaster('  coffea   circulor ', roasters)).toEqual({ roaster: 'Coffea Circulor' })
  })

  it('splits a known roaster from the bean name that follows', () => {
    expect(splitKnownRoaster('Coffea Circulor Brand New', roasters)).toEqual({
      roaster: 'Coffea Circulor',
      name: 'Brand New',
    })
  })

  it('prefers the longest roaster', () => {
    expect(splitKnownRoaster('Coffea Circulor Guji', roasters)?.roaster).toBe('Coffea Circulor')
    expect(splitKnownRoaster('Coffea Guji', roasters)).toEqual({ roaster: 'Coffea', name: 'Guji' })
  })

  it('ignores punctuation and case', () => {
    expect(splitKnownRoaster("fathers pink bourbon", roasters)).toEqual({ roaster: "Father's", name: 'pink bourbon' })
  })

  it('does not guess when no known roaster starts the text', () => {
    expect(splitKnownRoaster('Elto Arbegona', roasters)).toBeNull()
    expect(splitKnownRoaster('Brand New Coffea Circulor', roasters)).toBeNull()
    expect(splitKnownRoaster('', roasters)).toBeNull()
    expect(splitKnownRoaster('Coffea Circulor', [])).toBeNull()
  })
})

describe('uniqueRoasters', () => {
  it('drops spelling duplicates and sorts', () => {
    expect(uniqueRoasters(['Zed', 'coffea circulor', 'Coffea Circulor', 'Coffea-Circulor'])).toEqual([
      'coffea circulor',
      'Zed',
    ])
  })
})
