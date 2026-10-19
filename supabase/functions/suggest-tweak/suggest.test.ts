import { describe, expect, it } from 'vitest'
import { describeBrew, readSuggestion, type SuggestInput } from './suggest'

function answer(fields: Record<string, unknown>): string {
  return JSON.stringify({
    kind: 'change', changes: [{ direction: 'finer', amount: 20 }], test: false, reason: 'r', quote: null, look_for: 'l', plan: 'none', ...fields,
  })
}

const input: SuggestInput = {
  bean: { origin: 'Rwanda', process: 'Natural', roastLevel: null, roasterNotes: [] },
  recipe: { doseG: 15, waterG: 240, ratio: 16, tempC: 92, grindUm: 720, targetTimeS: 210, balance: -0.6, strength: 'medium', pourStartsS: [0, 45, 85, 125, 155] },
  actualTimeS: 682,
  tastes: ['weak'],
  improve: [],
  compared: null,
  note: 'Need to go finer next time.',
  lastChanges: [],
}

describe('readSuggestion', () => {
  it('keeps a sensible change', () => {
    expect(readSuggestion(answer({}), '')).toMatchObject({ kind: 'change', changes: [{ direction: 'finer', amount: 20 }], oversized: false, dropped: 0 })
  })

  it('keeps two changes on different axes', () => {
    const changes = [{ direction: 'finer', amount: 30 }, { direction: 'tighter', amount: 0.5 }]
    expect(readSuggestion(answer({ changes }), '').changes).toEqual(changes)
  })

  it('drops a second change on the same axis, and anything past two', () => {
    const changes = [{ direction: 'finer', amount: 30 }, { direction: 'hotter', amount: 1 }, { direction: 'tighter', amount: 0.5 }, { direction: 'sweeter', amount: 0.3 }]
    const read = readSuggestion(answer({ changes }), '')
    expect(read.changes.map((c) => c.direction)).toEqual(['finer', 'tighter'])
    expect(read.dropped).toBe(2)
  })

  it('brings steps into range and rounds them', () => {
    expect(readSuggestion(answer({ changes: [{ direction: 'finer', amount: 650 }] }), '')).toMatchObject({ changes: [{ amount: 60 }], oversized: true })
    expect(readSuggestion(answer({ changes: [{ direction: 'hotter', amount: 1.4 }] }), '').changes[0]!.amount).toBe(1)
    expect(readSuggestion(answer({ changes: [{ direction: 'longer_gaps', amount: 2 }] }), '').changes[0]!.amount).toBe(5)
    expect(readSuggestion(answer({ changes: [{ direction: 'stronger', amount: 4 }] }), '').changes[0]!.amount).toBeNull()
  })

  it('turns a change without usable changes into advice', () => {
    expect(readSuggestion(answer({ changes: [{ direction: 'sideways', amount: 1 }] }), '')).toMatchObject({ kind: 'advice', changes: [] })
    expect(readSuggestion(answer({ changes: [] }), '')).toMatchObject({ kind: 'advice', changes: [] })
  })

  it('has no changes for lock and advice', () => {
    expect(readSuggestion(answer({ kind: 'lock' }), '')).toMatchObject({ kind: 'lock', changes: [], dropped: 0 })
  })

  it('keeps a quote from the note and drops an invented one', () => {
    const note = 'Need to go  finer next time.'
    expect(readSuggestion(answer({ quote: 'go finer' }), note)).toMatchObject({ quote: 'go finer', inventedQuote: false })
    expect(readSuggestion(answer({ quote: 'too bitter' }), note)).toMatchObject({ quote: null, inventedQuote: true })
  })

  it('throws on something that is not JSON', () => {
    expect(() => readSuggestion('not json', '')).toThrow()
  })
})

describe('describeBrew', () => {
  it('treats a drawdown over three times the target as not timed', () => {
    expect(describeBrew(input)).toContain('Drawdown: not timed (target 3:30)')
    expect(describeBrew({ ...input, actualTimeS: 200 })).toContain('Drawdown: 3:20')
  })

  it('lists when each pour starts', () => {
    expect(describeBrew(input)).toContain('Pours start at: 0:00, 0:45, 1:25, 2:05, 2:35')
  })

  it('puts the note last, inside note tags', () => {
    expect(describeBrew(input).endsWith('<note>Need to go finer next time.</note>')).toBe(true)
  })
})
