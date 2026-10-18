import type { BeanMatch, NewBean, ScannedBag } from '../data/types'
import type { BagDetails } from './BagStep'
import { refineCatalogue } from './catalogue'

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** "Sey" and "Sey Coffee" are the same roaster; labels often add or drop the suffix. */
function sameRoaster(a: string, b: string): boolean {
  const [x, y] = [key(a), key(b)]
  return x.length > 0 && y.length > 0 && (x.startsWith(y) || y.startsWith(x))
}

/**
 * The catalogue bean a scan is of, when there is exactly one sensible answer: same roaster, and
 * every word of the scanned name starts a word of the bean. Several candidates fall back to an
 * exact name; anything less certain is treated as a new bean for the person to check.
 */
export function matchScan(scan: ScannedBag, catalogue: BeanMatch[]): BeanMatch | null {
  if (!scan.roaster || !scan.name) return null
  const { roaster, name } = scan
  const candidates = catalogue.filter((bean) => sameRoaster(bean.roaster, roaster) && refineCatalogue([bean], name).length === 1)
  if (candidates.length === 1) return candidates[0]
  return candidates.find((bean) => key(bean.name) === key(name)) ?? null
}

/** The new-bean form, filled from the label. Empty roaster or name are for the person to type. */
export function scanToNewBean(scan: ScannedBag): NewBean {
  return {
    roaster: scan.roaster ?? '',
    name: scan.name ?? '',
    origin: scan.origin ?? undefined,
    region: scan.region ?? undefined,
    producer: scan.producer ?? undefined,
    variety: scan.variety ?? undefined,
    process: scan.process ?? undefined,
    altitudeM: scan.altitudeM ?? undefined,
    roastLevel: scan.roastLevel ?? undefined,
    roasterNotes: scan.tastingNotes,
  }
}

export function scanToBag(scan: ScannedBag): BagDetails {
  return { roastDate: scan.roastDate, grams: scan.weightG }
}
