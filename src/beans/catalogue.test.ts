import { describe, expect, it } from 'vitest'
import type { BeanMatch } from '../data/types'
import { groupByRoaster, refineCatalogue } from './catalogue'

function match(roaster: string, name: string, extra: Partial<BeanMatch> = {}): BeanMatch {
  return {
    id: `${roaster}/${name}`,
    roaster,
    name,
    origin: null,
    region: null,
    producer: null,
    variety: null,
    process: null,
    altitudeM: null,
    roastLevel: null,
    roasterNotes: [],
    owned: false,
    friendsWithRecipe: 0,
    ...extra,
  }
}

const catalogue = [
  match('Coffea Circulor', 'Elto Arbegona', { origin: 'Ethiopia', process: 'Washed' }),
  match('Coffea Circulor', 'Finca Tamana', { origin: 'Colombia' }),
  match("Father's", 'Pink Bourbon', { origin: 'Colombia' }),
  match('La Cabra', 'Café de Altura', { origin: 'Peru' }),
]

const names = (beans: BeanMatch[]) => beans.map((bean) => bean.name)

describe('refineCatalogue', () => {
  it('shows everything, in order, before you type', () => {
    expect(refineCatalogue(catalogue, '  ')).toEqual(catalogue)
  })

  it('narrows from the first letter, by the start of a word', () => {
    expect(names(refineCatalogue(catalogue, 'p'))).toEqual(['Pink Bourbon', 'Café de Altura'])
    expect(names(refineCatalogue(catalogue, 'arbeg'))).toEqual(['Elto Arbegona'])
    expect(names(refineCatalogue(catalogue, 'bego'))).toEqual([])
  })

  it('needs every word, in any order, across roaster and name', () => {
    expect(names(refineCatalogue(catalogue, 'arbegona coffea'))).toEqual(['Elto Arbegona'])
    expect(names(refineCatalogue(catalogue, 'coffea pink'))).toEqual([])
  })

  it('matches origin and process too', () => {
    expect(names(refineCatalogue(catalogue, 'colombia'))).toEqual(['Finca Tamana', 'Pink Bourbon'])
    expect(names(refineCatalogue(catalogue, 'washed'))).toEqual(['Elto Arbegona'])
  })

  it('ignores case, accents and punctuation', () => {
    expect(names(refineCatalogue(catalogue, 'CAFE'))).toEqual(['Café de Altura'])
    expect(names(refineCatalogue(catalogue, 'fathers'))).toEqual(['Pink Bourbon'])
  })
})

describe('groupByRoaster', () => {
  it('groups consecutive beans under their roaster', () => {
    expect(groupByRoaster(catalogue).map((group) => [group.roaster, names(group.beans)])).toEqual([
      ['Coffea Circulor', ['Elto Arbegona', 'Finca Tamana']],
      ["Father's", ['Pink Bourbon']],
      ['La Cabra', ['Café de Altura']],
    ])
  })

  it('treats differently cased roaster names as one roaster', () => {
    expect(groupByRoaster([match('La Cabra', 'A'), match('la cabra', 'B')])).toHaveLength(1)
  })
})
