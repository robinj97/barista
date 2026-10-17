import { describe, expect, it } from 'vitest'
import { suggest } from '../../engine/suggest.ts'
import { SEED_BEANS } from '../dev/mockApi'
import { buildSuggestInput, clock } from './buildInput'
import { DEFAULT_CHOICES } from './params'

const geisha = SEED_BEANS.find((b) => b.id === 'b-geisha')!
const bag = { id: 'bag', bean: geisha, roastDate: '2026-10-12', gramsRemaining: 250, status: 'new' as const, createdAt: '' }
const cafec = { id: 'f', brand: 'CAFEC', model: 'T-90', size: '02', material: 'paper', flow_class: 'fast', bleached: null, created_by: null, match_key: 'cafect90' }

describe('buildSuggestInput', () => {
  it('carries the bean, the goal and the filter into the engine input', () => {
    const input = buildSuggestInput(bag, { ...DEFAULT_CHOICES, balance: 0.6, strength: 'strong', cups: 3 }, cafec, '2026-10-17')
    expect(input.method).toBe('v60')
    expect(input.bean).toMatchObject({ id: 'b-geisha', process: 'Washed', variety: 'Geisha', roastLevel: 'light', roastDate: '2026-10-12' })
    expect(input.bean.notes).toEqual(['black tea', 'candied lemon', 'vanilla'])
    expect(input.target).toEqual({ balance: 0.6, strength: 'strong', emphasise: [] })
    expect(input.cups).toBe(3)
    expect(input.filter).toEqual({ id: 'f', brand: 'CAFEC', model: 'T-90', flowClass: 'fast' })
    expect(input.asOf).toBe('2026-10-17')
  })

  it('does not send tasting notes: their effect on the cup is unproven', () => {
    expect(buildSuggestInput(bag, DEFAULT_CHOICES, null, '2026-10-17').target.emphasise).toEqual([])
  })

  it('works with no filter', () => {
    expect(buildSuggestInput(bag, DEFAULT_CHOICES, null, '2026-10-17').filter).toBeNull()
  })

  it('produces something the engine accepts', () => {
    const out = suggest(buildSuggestInput(bag, DEFAULT_CHOICES, cafec, '2026-10-17'))
    expect(out.recipe.waterG).toBe(300)
    expect(out.recipe.pours.at(-1)!.toG).toBe(300)
  })
})

describe('clock', () => {
  it('formats m:ss', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(55)).toBe('0:55')
    expect(clock(95)).toBe('1:35')
    expect(clock(220)).toBe('3:40')
    expect(clock(-3)).toBe('0:00')
  })
})
