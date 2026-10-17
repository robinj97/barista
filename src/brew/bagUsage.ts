import type { Bag, BagPatch } from '../data/types'

/**
 * What a finished brew does to the bag: the coffee is used up, and a bag that was new is now
 * being dialed in. Taken at the end of the drawdown, because by then the coffee is spent.
 * A cancelled brew changes nothing.
 */
export function afterBrew(bag: Bag, doseG: number): BagPatch {
  return {
    ...(bag.gramsRemaining !== null ? { gramsRemaining: Math.max(0, Math.round((bag.gramsRemaining - doseG) * 10) / 10) } : {}),
    ...(bag.status === 'new' ? { status: 'dialing_in' as const } : {}),
  }
}

/** Locking a recipe in means the bag is dialed in. */
export function afterLock(bag: Bag): BagPatch {
  return bag.status === 'locked' ? {} : { status: 'locked' }
}

export const isEmpty = (patch: BagPatch): boolean => Object.keys(patch).length === 0
