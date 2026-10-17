/** Reading free-text bean traits (process, variety, notes) into comparable values. */

export type ProcessGroup = 'washed' | 'natural' | 'honey' | 'anaerobic'
export type VarietyGroup = 'geisha' | 'bourbon' | 'sl' | 'heirloom' | 'typica'

/** Lower case, trimmed, single spaces: how every trait and note is compared. */
export const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ')

// Order matters: the first match wins, so "anaerobic natural" is anaerobic and "pulped natural" is honey.
const PROCESS_GROUPS: [ProcessGroup, RegExp][] = [
  ['anaerobic', /anaerobic|carbonic/],
  ['honey', /honey|pulped/],
  ['natural', /natural|dry/],
  ['washed', /wash/],
]

// Caturra and Catuaí descend from Bourbon; Java and Maragogipe from Typica.
const VARIETY_GROUPS: [VarietyGroup, RegExp][] = [
  ['geisha', /geisha|gesha/],
  ['sl', /\bsl[- ]?\d+/],
  ['heirloom', /heirloom|landrace/],
  ['bourbon', /bourbon|caturra|catua[ií]|pacas/],
  ['typica', /typica|java|maragogipe/],
]

const classify = <G extends string>(text: string | null | undefined, groups: [G, RegExp][]): G | null => {
  const value = normalise(text ?? '')
  return groups.find(([, pattern]) => pattern.test(value))?.[0] ?? null
}

/** The process family, or null when it is missing or not one we group. */
export const processGroup = (process?: string | null) => classify(process, PROCESS_GROUPS)

/** The variety family, or null when it is missing or not one we group. */
export const varietyGroup = (variety?: string | null) => classify(variety, VARIETY_GROUPS)
