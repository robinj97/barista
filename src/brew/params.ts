import { LIMITS, validateOverrides } from '../../engine/overrides.ts'
import type { OverrideKey, Pour, Strength } from '../../engine/types.ts'

/** The choices on the set-up screen, kept in the URL so the recipe screen, back button and links all agree. */
/**
 * 'brighter' is the internal name (balance +1). The app calls it "more acidity" because that is
 * what the 4:6 sources say, and "acidity" in coffee means the pleasant, lively tang, not sour.
 */
export type Goal = 'sweeter' | 'balanced' | 'brighter'

export const GOAL_LABELS: Record<Goal, string> = {
  sweeter: 'Sweeter',
  balanced: 'Balanced',
  brighter: 'More acidity',
}

export const GOAL_BALANCE: Record<Goal, number> = { sweeter: -0.6, balanced: 0, brighter: 0.6 }
export const STRENGTHS: Strength[] = ['light', 'medium', 'strong']

/** Values the person set by hand on the recipe screen. Anything missing comes from the suggestion. */
export interface RecipeEdits {
  doseG?: number
  waterG?: number
  ratio?: number
  tempC?: number
  /** Microns, whatever the grinder's own units are. */
  grindUm?: number
  pours?: Pour[]
  targetTimeS?: number
}

export interface BrewChoices {
  bagId: string | null
  /** -1 sweeter ... +1 more acidity. The goal chips are presets of this. */
  balance: number
  strength: Strength
  grinderId: string | null
  /** A filter id, 'none' for no filter, or null for the default. */
  filterId: string | null
  cups: number
  edits: RecipeEdits
}

export const DEFAULT_CHOICES: BrewChoices = {
  bagId: null,
  balance: 0,
  strength: 'medium',
  grinderId: null,
  filterId: null,
  cups: 2,
  edits: {},
}

/** Which goal chip matches this balance exactly, or null for a custom value. */
export function goalOf(balance: number): Goal | null {
  return (Object.keys(GOAL_BALANCE) as Goal[]).find((goal) => Math.abs(GOAL_BALANCE[goal] - balance) < 0.001) ?? null
}

/** A number in the URL, kept only if it is inside the engine's limits. Rounded to `places` decimals. */
function readNumber(params: URLSearchParams, name: string, [lo, hi]: readonly [number, number], places: number): number | undefined {
  const raw = params.get(name)
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < lo || value > hi) return undefined
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** "0:50,40:110" is pour 1 at 0 s to 50 g, pour 2 at 40 s to 110 g. Anything the engine would refuse is dropped. */
function readPours(params: URLSearchParams): Pour[] | undefined {
  const raw = params.get('pours')
  if (!raw) return undefined
  const pours = raw.split(',').map((pair) => {
    const [atS, toG] = pair.split(':').map(Number)
    return { atS: Math.round(atS ?? Number.NaN), toG: Math.round(toG ?? Number.NaN) }
  })
  try {
    validateOverrides({ pours })
    return pours
  } catch {
    return undefined
  }
}

function readEdits(params: URLSearchParams): RecipeEdits {
  const edits: RecipeEdits = {
    doseG: readNumber(params, 'dose', LIMITS.doseG, 1),
    waterG: readNumber(params, 'water', LIMITS.waterG, 0),
    ratio: readNumber(params, 'ratio', LIMITS.ratio, 1),
    tempC: readNumber(params, 'temp', LIMITS.tempC, 1),
    grindUm: readNumber(params, 'grind', LIMITS.grindUm, 0),
    pours: readPours(params),
    targetTimeS: readNumber(params, 'time', LIMITS.targetTimeS, 0),
  }
  return Object.fromEntries(Object.entries(edits).filter(([, value]) => value !== undefined)) as RecipeEdits
}

export function parseChoices(params: URLSearchParams): BrewChoices {
  const balance = Number(params.get('balance'))
  const strength = params.get('strength') as Strength
  const cups = Number(params.get('cups'))

  return {
    bagId: params.get('bag') || null,
    balance: params.has('balance') && Number.isFinite(balance) ? Math.round(Math.min(1, Math.max(-1, balance)) * 10) / 10 : DEFAULT_CHOICES.balance,
    strength: STRENGTHS.includes(strength) ? strength : DEFAULT_CHOICES.strength,
    grinderId: params.get('grinder') || null,
    filterId: params.get('filter') || null,
    cups: Number.isInteger(cups) && cups >= 1 && cups <= 4 ? cups : DEFAULT_CHOICES.cups,
    edits: readEdits(params),
  }
}

export function toSearchParams(choices: BrewChoices): URLSearchParams {
  const params = new URLSearchParams()
  if (choices.bagId) params.set('bag', choices.bagId)
  params.set('balance', String(choices.balance))
  params.set('strength', choices.strength)
  if (choices.grinderId) params.set('grinder', choices.grinderId)
  if (choices.filterId) params.set('filter', choices.filterId)
  params.set('cups', String(choices.cups))
  const { edits } = choices
  if (edits.doseG !== undefined) params.set('dose', String(edits.doseG))
  if (edits.waterG !== undefined) params.set('water', String(edits.waterG))
  if (edits.ratio !== undefined) params.set('ratio', String(edits.ratio))
  if (edits.tempC !== undefined) params.set('temp', String(edits.tempC))
  if (edits.grindUm !== undefined) params.set('grind', String(edits.grindUm))
  if (edits.pours) params.set('pours', edits.pours.map((p) => `${p.atS}:${p.toG}`).join(','))
  if (edits.targetTimeS !== undefined) params.set('time', String(edits.targetTimeS))
  return params
}

/** Maps the engine's override keys to the URL-backed edit they came from. */
export const EDIT_FIELD: Record<OverrideKey, keyof RecipeEdits> = {
  doseG: 'doseG',
  waterG: 'waterG',
  ratio: 'ratio',
  pours: 'pours',
  tempC: 'tempC',
  grindUm: 'grindUm',
  targetTimeS: 'targetTimeS',
}
