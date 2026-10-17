import type { BeanTraits, Method, PriorRecipe } from './types.ts'

export type ProcessGroup = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other'
export type VarietyGroup = 'geisha' | 'bourbon' | 'sl' | 'heirloom' | 'typica' | 'other'

export function processGroup(process?: string | null): ProcessGroup {
  const text = (process ?? '').toLowerCase()
  if (text.includes('anaerobic') || text.includes('carbonic')) return 'anaerobic'
  if (text.includes('natural') || text.includes('dry')) return 'natural'
  if (text.includes('honey') || text.includes('pulped')) return 'honey'
  if (text.includes('wash')) return 'washed'
  return 'other'
}

export function varietyGroup(variety?: string | null): VarietyGroup {
  const text = (variety ?? '').toLowerCase()
  if (text.includes('geisha') || text.includes('gesha')) return 'geisha'
  if (text.includes('bourbon')) return 'bourbon'
  if (/\bsl[- ]?\d+/.test(text)) return 'sl'
  if (text.includes('heirloom')) return 'heirloom'
  if (/(typica|caturra|catuai|catu[ií]|java|maragogipe)/.test(text)) return 'typica'
  return 'other'
}

const sameText = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

function roastScore(a?: string | null, b?: string | null): number {
  const order = ['light', 'medium', 'dark']
  if (!a || !b) return 0
  const gap = Math.abs(order.indexOf(a) - order.indexOf(b))
  return gap === 0 ? 1 : gap === 1 ? 0.5 : 0
}

function altitudeScore(a?: number | null, b?: number | null): number {
  if (!a || !b) return 0
  const gap = Math.abs(a - b)
  return gap <= 200 ? 1 : gap <= 500 ? 0.5 : 0
}

function noteOverlap(a: string[], b: string[]): number {
  const left = new Set(a.map((note) => note.toLowerCase()))
  const right = new Set(b.map((note) => note.toLowerCase()))
  if (left.size === 0 || right.size === 0) return 0
  const shared = [...left].filter((note) => right.has(note)).length
  return shared / new Set([...left, ...right]).size
}

/** Less shared information than this and two coffees are not compared at all. */
const MIN_EVIDENCE = 0.5

/**
 * How alike two coffees are, 0 to 1. Only fields both coffees have are compared, so a bean
 * with little recorded is not marked down for what is missing; but if too little is shared
 * (under half the total weight) the answer is 0, so two coffees are never "identical" on a
 * single field. Weights: origin 0.25, process group 0.25, roast level 0.2, variety group 0.1,
 * notes 0.1, altitude 0.1. A hand-set starting point, not a fitted model.
 */
export function similarity(a: BeanTraits, b: BeanTraits): number {
  let score = 0
  let known = 0
  const add = (weight: number, comparable: boolean, value: number) => {
    if (!comparable) return
    known += weight
    score += weight * value
  }

  add(0.25, !!a.origin?.trim() && !!b.origin?.trim(), sameText(a.origin, b.origin) ? 1 : 0)
  const [pa, pb] = [processGroup(a.process), processGroup(b.process)]
  add(0.25, pa !== 'other' && pb !== 'other', pa === pb ? 1 : 0)
  add(0.2, !!a.roastLevel && !!b.roastLevel, roastScore(a.roastLevel, b.roastLevel))
  const [va, vb] = [varietyGroup(a.variety), varietyGroup(b.variety)]
  add(0.1, va !== 'other' && vb !== 'other', va === vb ? 1 : 0)
  add(0.1, a.notes.length > 0 && b.notes.length > 0, noteOverlap(a.notes, b.notes))
  add(0.1, !!a.altitudeM && !!b.altitudeM, altitudeScore(a.altitudeM, b.altitudeM))

  return known < MIN_EVIDENCE ? 0 : score / known
}

export interface Neighbour {
  prior: PriorRecipe
  similarity: number
}

/** Recipes for similar (not identical) coffees, most alike first. */
export function nearestPriors(
  bean: BeanTraits & { id?: string },
  method: Method,
  priors: PriorRecipe[],
  minSimilarity = 0.6,
): Neighbour[] {
  return priors
    .filter((prior) => prior.method === method && prior.beanId !== bean.id)
    .map((prior) => ({ prior, similarity: similarity(bean, prior.bean) }))
    .filter((n) => n.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
}
