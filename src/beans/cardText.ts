import type { Bag, Bean } from '../data/types'

/** The accent line above a bean's name: variety (or origin when there is none) and process. */
export function eyebrow(bean: Bean): string | null {
  const parts = [bean.variety?.trim() || bean.origin, bean.process].filter((part): part is string => !!part?.trim())
  return parts.length ? parts.join(' · ') : null
}

/** The first few tasting notes and how many were left out. */
export function visibleNotes(notes: string[], max = 3): { shown: string[]; extra: number } {
  return { shown: notes.slice(0, max), extra: Math.max(0, notes.length - max) }
}

/**
 * Does a bag match what was typed in the search box? Every word must appear somewhere in the
 * bean's name, roaster, variety, process, origin, region, producer or tasting notes, so "geisha"
 * and "washed jasmine" both work. An empty search matches everything.
 */
export function matchesSearch(bag: Bag, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const { bean } = bag
  const haystack = [
    bean.name,
    bean.roaster,
    bean.variety,
    bean.process,
    bean.origin,
    bean.region,
    bean.producer,
    ...bean.roasterNotes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}
