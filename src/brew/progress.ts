import type { Pour } from '../../engine/types.ts'

/** How fast water goes in. Only used to tell when a pour is over and the drawdown begins. */
export const POUR_RATE_G_PER_S = 4

export type Phase =
  | { kind: 'pouring'; index: number }
  | { kind: 'waiting'; index: number; nextAtS: number }
  | { kind: 'drawdown' }

const amountOf = (pours: Pour[], index: number) => pours[index]!.toG - (pours[index - 1]?.toG ?? 0)

/** When pour `index` is expected to be over: when its water has gone in, but never later than the next pour. */
export function pourEndS(pours: Pour[], index: number): number {
  const end = pours[index]!.atS + amountOf(pours, index) / POUR_RATE_G_PER_S
  const next = pours[index + 1]
  return next ? Math.min(end, next.atS) : end
}

/** Where a brew is after `elapsedS` seconds, from the schedule alone: nobody has to tap between pours. */
export function phaseAt(pours: Pour[], elapsedS: number): Phase {
  let index = 0
  while (index + 1 < pours.length && elapsedS >= pours[index + 1]!.atS) index += 1
  if (elapsedS < pourEndS(pours, index)) return { kind: 'pouring', index }
  const next = pours[index + 1]
  return next ? { kind: 'waiting', index, nextAtS: next.atS } : { kind: 'drawdown' }
}

/** The pour the ring and list should point at. */
export const currentIndex = (phase: Phase, pours: Pour[]): number => (phase.kind === 'drawdown' ? pours.length - 1 : phase.index)
