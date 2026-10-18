import type { Bag, Draft } from '../data/types'

export const DEFAULT_DOSE_G = 20
/** A bag is "running low" under this many doses. */
export const LOW_DOSES = 3

/** What you usually brew from a bean: the coffee in its last brew, else its working recipe, else 20 g. */
export function usualDoseG(beanId: string, drafts: Draft[] | undefined): number {
  const draft = drafts?.find((d) => d.beanId === beanId && d.method === 'v60')
  if (!draft) return DEFAULT_DOSE_G
  return draft.lastBrew?.recipe?.doseG ?? draft.choices.edits.doseG ?? draft.choices.cups * 10
}

export type Stock = { state: 'empty' } | { state: 'low'; brewsLeft: number }

/** Null when there is nothing to say: the amount is not set, the bag is finished, or plenty is left. */
export function stockOf(bag: Pick<Bag, 'gramsRemaining' | 'finishedAt'>, doseG: number): Stock | null {
  if (bag.finishedAt || bag.gramsRemaining == null) return null
  if (bag.gramsRemaining <= 0) return { state: 'empty' }
  if (bag.gramsRemaining < LOW_DOSES * doseG) return { state: 'low', brewsLeft: Math.floor(bag.gramsRemaining / doseG) }
  return null
}

export function stockText(stock: Stock): string {
  if (stock.state === 'empty') return 'Empty'
  if (stock.brewsLeft < 1) return 'Running low · less than one brew left'
  return `Running low · about ${stock.brewsLeft} ${stock.brewsLeft === 1 ? 'brew' : 'brews'} left`
}
