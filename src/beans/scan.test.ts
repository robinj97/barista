import { describe, expect, it } from 'vitest'
import type { BeanMatch, ScannedBag } from '../data/types'
import { EMPTY_SCAN } from '../../supabase/functions/scan-bag/label'
import { matchScan, scanToBag, scanToNewBean } from './scan'

function match(id: string, roaster: string, name: string): BeanMatch {
  return {
    id, roaster, name, origin: null, region: null, producer: null, variety: null, process: null,
    altitudeM: null, roastLevel: null, roasterNotes: [], owned: false, friendsWithRecipe: 0,
  }
}

const catalogue = [
  match('elto', 'Coffea Circulor', 'Elto Arbegona'),
  match('guji', 'Coffea Circulor', 'Guji Natural'),
  match('guji-w', 'Coffea Circulor', 'Guji Washed'),
  match('gat', 'Sey Coffee', 'Gatomboya AA'),
]

const scan = (fields: Partial<ScannedBag>): ScannedBag => ({ ...EMPTY_SCAN, readable: true, ...fields })

describe('matchScan', () => {
  it('finds the catalogue bean by roaster and name', () => {
    expect(matchScan(scan({ roaster: 'COFFEA CIRCULOR', name: 'Elto Arbegona' }), catalogue)?.id).toBe('elto')
  })

  it('accepts a roaster with or without its suffix, and a shortened name', () => {
    expect(matchScan(scan({ roaster: 'Sey', name: 'Gatomboya' }), catalogue)?.id).toBe('gat')
  })

  it('does not pick one of several beans that fit', () => {
    expect(matchScan(scan({ roaster: 'Coffea Circulor', name: 'Guji' }), catalogue)).toBeNull()
    expect(matchScan(scan({ roaster: 'Coffea Circulor', name: 'Guji Natural' }), catalogue)?.id).toBe('guji')
  })

  it('treats a different roaster, or a missing name, as a new bean', () => {
    expect(matchScan(scan({ roaster: 'La Cabra', name: 'Elto Arbegona' }), catalogue)).toBeNull()
    expect(matchScan(scan({ roaster: 'Coffea Circulor', name: null }), catalogue)).toBeNull()
  })
})

describe('scan to forms', () => {
  it('fills the new-bean form and the bag, leaving unknowns empty', () => {
    const read = scan({ roaster: 'Sey', name: 'Gatomboya AA', origin: 'Kenya', tastingNotes: ['blackcurrant'], roastDate: '2026-10-10', weightG: 250 })
    expect(scanToNewBean(read)).toEqual({
      roaster: 'Sey', name: 'Gatomboya AA', origin: 'Kenya', region: undefined, producer: undefined, variety: undefined,
      process: undefined, altitudeM: undefined, roastLevel: undefined, roasterNotes: ['blackcurrant'],
    })
    expect(scanToBag(read)).toEqual({ roastDate: '2026-10-10', grams: 250 })
  })
})
