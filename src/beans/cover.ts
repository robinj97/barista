/** A stable pebble shape and tint for a bean, chosen from its id so it never changes. */

const TINTS = ['bg-tint-sand', 'bg-tint-rose', 'bg-tint-sage', 'bg-tint-sky'] as const
const PEBBLES = ['pebble-1', 'pebble-2', 'pebble-3'] as const

function hash(input: string): number {
  let h = 0x811c9dc5 // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function beanCover(id: string): { tint: string; pebble: string } {
  const h = hash(id)
  return { tint: TINTS[h % TINTS.length]!, pebble: PEBBLES[(h >>> 8) % PEBBLES.length]! }
}
