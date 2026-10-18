import { describe, expect, it } from 'vitest'
import { EMPTY_SCAN, readScan, scanRequest } from './label'

const today = new Date(2026, 9, 18)

function answer(fields: Record<string, unknown>): string {
  return JSON.stringify({
    readable: true,
    roaster: null,
    name: null,
    origin: null,
    region: null,
    producer: null,
    variety: null,
    process: null,
    altitude_m: null,
    roast_level: null,
    tasting_notes: [],
    roast_date: null,
    weight_g: null,
    ...fields,
  })
}

describe('readScan', () => {
  it('maps a full label onto the bag fields', () => {
    const scan = readScan(
      answer({
        roaster: ' Coffea  Circulor ',
        name: 'Elto Arbegona',
        origin: 'Ethiopia',
        region: 'Sidama',
        process: 'Washed',
        altitude_m: 2100,
        roast_level: 'light',
        tasting_notes: ['Bergamot', 'tangerine', 'bergamot'],
        roast_date: '2026-10-10',
        weight_g: 250,
      }),
      today,
    )
    expect(scan).toMatchObject({
      readable: true,
      roaster: 'Coffea Circulor',
      name: 'Elto Arbegona',
      altitudeM: 2100,
      roastLevel: 'light',
      tastingNotes: ['bergamot', 'tangerine'],
      roastDate: '2026-10-10',
      weightG: 250,
    })
  })

  it('drops values that cannot be right', () => {
    const scan = readScan(
      answer({ altitude_m: 21000, weight_g: 0, roast_level: 'blonde', roast_date: '2026-02-30', name: '   ' }),
      today,
    )
    expect(scan).toMatchObject({ altitudeM: null, weightG: null, roastLevel: null, roastDate: null, name: null })
  })

  it('never accepts a roast date in the future or over two years ago', () => {
    expect(readScan(answer({ roast_date: '2026-10-19' }), today).roastDate).toBeNull()
    expect(readScan(answer({ roast_date: '2024-10-17' }), today).roastDate).toBeNull()
    expect(readScan(answer({ roast_date: '2026-10-18' }), today).roastDate).toBe('2026-10-18')
  })

  it('returns nothing at all for an unreadable photo', () => {
    expect(readScan(answer({ readable: false, roaster: 'Somebody' }), today)).toEqual(EMPTY_SCAN)
  })

  it('throws on an answer that is not JSON', () => {
    expect(() => readScan('Sorry, I cannot read this', today)).toThrow()
  })
})

describe('scanRequest', () => {
  it('asks Haiku for the schema at the chosen effort, with the photo first', () => {
    const request = scanRequest('abc', 'image/jpeg', 'low')
    expect(request.model).toBe('claude-haiku-5-5')
    expect(request.output_config.effort).toBe('low')
    expect(request.output_config.format.type).toBe('json_schema')
    expect(request.messages[0].content[0]).toMatchObject({ type: 'image', source: { data: 'abc', media_type: 'image/jpeg' } })
  })
})
