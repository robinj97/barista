import { describe, expect, it } from 'vitest'
import { ringSegments } from './ringSegments'

const pours = [
  { atS: 0, toG: 70 },
  { atS: 44, toG: 120 },
  { atS: 80, toG: 180 },
  { atS: 120, toG: 240 },
  { atS: 173, toG: 300 },
]

describe('ringSegments', () => {
  it('makes one arc per pour, sized by the water each adds', () => {
    const arcs = ringSegments(pours, 300)
    expect(arcs).toHaveLength(5)
    expect(arcs[0]!.length).toBeGreaterThan(arcs[1]!.length)
    expect(arcs[2]!.length).toBeCloseTo(arcs[3]!.length)
  })

  it('keeps arcs inside the circle and in order', () => {
    const arcs = ringSegments(pours, 300)
    arcs.forEach((arc, index) => {
      expect(arc.length).toBeGreaterThanOrEqual(0)
      expect(arc.start + arc.length).toBeLessThanOrEqual(300)
      if (index > 0) expect(arc.start).toBeGreaterThan(arcs[index - 1]!.start)
    })
  })

  it('returns nothing for an empty schedule', () => {
    expect(ringSegments([], 300)).toEqual([])
  })
})
