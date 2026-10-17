import type { Strength } from '../../engine/types.ts'

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

export interface BrewChoices {
  bagId: string | null
  /** -1 sweeter ... +1 more acidity. The goal chips are presets of this. */
  balance: number
  strength: Strength
  grinderId: string | null
  /** A filter id, 'none' for no filter, or null for the default. */
  filterId: string | null
  cups: number
}

export const DEFAULT_CHOICES: BrewChoices = {
  bagId: null,
  balance: 0,
  strength: 'medium',
  grinderId: null,
  filterId: null,
  cups: 2,
}

/** Which goal chip matches this balance exactly, or null for a custom value. */
export function goalOf(balance: number): Goal | null {
  return (Object.keys(GOAL_BALANCE) as Goal[]).find((goal) => Math.abs(GOAL_BALANCE[goal] - balance) < 0.001) ?? null
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
  return params
}
