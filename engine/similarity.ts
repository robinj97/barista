import { sum } from './math.ts'
import { normalise, processGroup, varietyGroup } from './traits.ts'
import { ROAST_LEVELS, type BeanTraits, type PriorRecipe, type RoastLevel } from './types.ts'

/** Compared on the family when we know it ("Fully washed" = "Washed"), otherwise on the text itself. */
const traitKey = (text: string | null | undefined, group: string | null) => group ?? (normalise(text ?? '') || null)

const same = <T>(a: T, b: T) => (a === b ? 1 : 0)

const roastScore = (a: RoastLevel, b: RoastLevel) => [1, 0.5, 0][Math.abs(ROAST_LEVELS.indexOf(a) - ROAST_LEVELS.indexOf(b))]!

function altitudeScore(a: number, b: number): number {
  const gap = Math.abs(a - b)
  return gap <= 200 ? 1 : gap <= 500 ? 0.5 : 0
}

const noteSet = (notes: string[]) => (notes.length > 0 ? new Set(notes.map(normalise)) : null)

/** Shared notes over all notes (Jaccard). */
const noteOverlap = (a: Set<string>, b: Set<string>) => [...a].filter((note) => b.has(note)).length / new Set([...a, ...b]).size

/** The score for one field, or null when either coffee lacks it. */
const compare = <T>(a: T | null | undefined, b: T | null | undefined, score: (a: T, b: T) => number): number | null =>
  a == null || b == null ? null : score(a, b)

/** Less shared information than this and two coffees are not compared at all. */
const MIN_EVIDENCE = 0.5

/**
 * How alike two coffees are, 0 to 1. Only fields both coffees have are compared, so a bean
 * with little recorded is not marked down for what is missing; but if too little is shared
 * (under half the total weight) the answer is 0, so two coffees are never "identical" on a
 * single field. Weights: origin 0.25, process 0.25, roast level 0.2, variety 0.1, notes 0.1,
 * altitude 0.1. A hand-set starting point, not a fitted model.
 */
export function similarity(a: BeanTraits, b: BeanTraits): number {
  const fields: [weight: number, score: number | null][] = [
    [0.25, compare(traitKey(a.origin, null), traitKey(b.origin, null), same)],
    [0.25, compare(traitKey(a.process, processGroup(a.process)), traitKey(b.process, processGroup(b.process)), same)],
    [0.2, compare(a.roastLevel, b.roastLevel, roastScore)],
    [0.1, compare(traitKey(a.variety, varietyGroup(a.variety)), traitKey(b.variety, varietyGroup(b.variety)), same)],
    [0.1, compare(noteSet(a.notes), noteSet(b.notes), noteOverlap)],
    [0.1, compare(a.altitudeM, b.altitudeM, altitudeScore)],
  ]
  const known = fields.filter((field): field is [number, number] => field[1] !== null)
  const weight = sum(known.map(([w]) => w))
  return weight < MIN_EVIDENCE ? 0 : sum(known.map(([w, score]) => w * score)) / weight
}

export interface Neighbour {
  prior: PriorRecipe
  similarity: number
}

/** Recipes for similar (not identical) coffees, most alike first. Callers pass recipes for one method. */
export function nearestPriors(bean: BeanTraits & { id?: string }, priors: PriorRecipe[], minSimilarity = 0.6): Neighbour[] {
  return priors
    .filter((prior) => prior.beanId !== bean.id)
    .map((prior) => ({ prior, similarity: similarity(bean, prior.bean) }))
    .filter((n) => n.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
}
