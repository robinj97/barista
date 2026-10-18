import { describe, expect, it } from 'vitest'
import { processGroup } from '../../engine/traits.ts'
import { composeProcess, parseProcess } from './lists'

describe('composeProcess', () => {
  it('joins the chips, with anaerobic first and the rest in lower case', () => {
    expect(composeProcess(['Washed', 'Anaerobic'])).toBe('Anaerobic washed')
    expect(composeProcess(['Natural', 'Anaerobic'])).toBe('Anaerobic natural')
    expect(composeProcess(['Washed'])).toBe('Washed')
  })

  it('adds free text after a comma, or stands alone', () => {
    expect(composeProcess(['Washed'], '  thermal shock ')).toBe('Washed, thermal shock')
    expect(composeProcess([], 'Carbonic maceration')).toBe('Carbonic maceration')
    expect(composeProcess([], '')).toBe('')
  })

  it('is still understood by the engine as an anaerobic process', () => {
    expect(processGroup(composeProcess(['Washed', 'Anaerobic']))).toBe('anaerobic')
    expect(processGroup(composeProcess(['Natural']))).toBe('natural')
  })
})

describe('parseProcess', () => {
  it('reads a saved process back into chips and free text', () => {
    expect(parseProcess('Anaerobic washed')).toEqual({ chips: ['Washed', 'Anaerobic'], other: '' })
    expect(parseProcess('Washed, thermal shock')).toEqual({ chips: ['Washed'], other: 'thermal shock' })
    expect(parseProcess('Carbonic maceration')).toEqual({ chips: [], other: 'Carbonic maceration' })
    expect(parseProcess(null)).toEqual({ chips: [], other: '' })
  })

  it('round-trips what compose produces', () => {
    for (const chips of [['Washed'], ['Honey', 'Anaerobic'], []] as const) {
      const text = composeProcess([...chips], 'extra')
      const back = parseProcess(text)
      expect(composeProcess(back.chips, back.other)).toBe(text)
    }
  })
})
