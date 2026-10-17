export interface RingPour {
  atS: number
  toG: number
}

export interface RingSegment {
  start: number
  length: number
}

const GAP = 22

/** Arc geometry for each pour, sized by the water it adds (pours use cumulative grams). */
export function ringSegments(pours: RingPour[], circumference: number): RingSegment[] {
  const total = pours.at(-1)?.toG ?? 0
  if (total <= 0) return []
  let previous = 0
  return pours.map((pour) => {
    const share = (pour.toG - previous) / total
    const start = (previous / total) * circumference + GAP / 2
    previous = pour.toG
    return { start, length: Math.max(0, share * circumference - GAP) }
  })
}
