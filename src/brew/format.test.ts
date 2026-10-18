import { describe, expect, it } from 'vitest'
import { recipeSummary, recipeText } from './format'

const numbers = { doseG: 20, waterG: 300, ratio: 15, tempC: 95, targetTimeS: 210 }

describe('recipeText', () => {
  it('formats every number the way the screens show it', () => {
    expect(recipeText(numbers, 'c')).toEqual({ coffee: '20 g', water: '300 g', ratio: '1:15', temp: '95°C', time: '~3:30' })
  })

  it('uses your temperature unit', () => {
    expect(recipeText(numbers, 'f').temp).toBe('203°F')
  })
})

describe('recipeSummary', () => {
  it('is one line for a list row, with the grind when there is one', () => {
    expect(recipeSummary(numbers, 'c')).toBe('20 g · 300 g · 95°C')
    expect(recipeSummary(numbers, 'c', '98 clicks')).toBe('20 g · 300 g · 95°C · 98 clicks')
  })

  it('follows your temperature unit, which the Library and bean page used to ignore', () => {
    expect(recipeSummary(numbers, 'f')).toBe('20 g · 300 g · 203°F')
  })
})
