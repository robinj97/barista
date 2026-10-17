import type { BeanMatch } from '../data/types'

/** Lowercase, accents dropped, letters and digits only, so "Café" matches "cafe". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function searchWords(bean: BeanMatch): string[] {
  return [bean.roaster, bean.name, bean.origin, bean.region, bean.producer, bean.variety, bean.process]
    .filter((field): field is string => Boolean(field))
    .flatMap((field) => field.split(/[\s-]+/))
    .map(normalize)
    .filter(Boolean)
}

/**
 * Narrows the alphabetical catalogue as you type, like a contacts list: every typed word has
 * to start a word in the roaster, name or origin details, in any order. Keeps the order.
 */
export function refineCatalogue(beans: BeanMatch[], query: string): BeanMatch[] {
  const tokens = query.split(/\s+/).map(normalize).filter(Boolean)
  if (tokens.length === 0) return beans
  return beans.filter((bean) => {
    const words = searchWords(bean)
    return tokens.every((token) => words.some((word) => word.startsWith(token)))
  })
}

export interface RoasterGroup {
  roaster: string
  beans: BeanMatch[]
}

/** Consecutive beans from the same roaster (ignoring case), for the sticky roaster headings. */
export function groupByRoaster(beans: BeanMatch[]): RoasterGroup[] {
  const groups: RoasterGroup[] = []
  for (const bean of beans) {
    const last = groups.at(-1)
    if (last && last.roaster.toLowerCase() === bean.roaster.toLowerCase()) last.beans.push(bean)
    else groups.push({ roaster: bean.roaster, beans: [bean] })
  }
  return groups
}
