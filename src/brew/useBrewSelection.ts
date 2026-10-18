import { useMyBags, useMyDrafts, useMyFilters, useMyGrinders, useProfile } from '../data/hooks'
import type { Bag, MyFilter, MyGrinder } from '../data/types'
import type { BrewChoices } from './params'

/**
 * Resolves the choices in the URL against your own beans and gear. Anything not chosen falls back
 * to what you used last: the bean you brewed most recently, and the grinder and filter of your last
 * brew. With no history yet: the newest bag, your first grinder, your default filter. Finished bags
 * are never picked on their own.
 */
export function useBrewSelection(choices: BrewChoices) {
  const bags = useMyBags()
  const grinders = useMyGrinders()
  const filters = useMyFilters()
  const profile = useProfile()
  const drafts = useMyDrafts()

  // Your working recipes, most recently used first.
  const recent = [...(drafts.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const active = (bags.data ?? []).filter((candidate) => !candidate.finishedAt)

  const requested = choices.bagId ? bags.data?.find((bag) => bag.id === choices.bagId) : undefined
  const lastBrewed = recent.map((draft) => active.find((candidate) => candidate.bean.id === draft.beanId)).find(Boolean)
  const bag: Bag | undefined = requested ?? lastBrewed ?? active[0]
  /** A bag was named in the link but is not in your beans. */
  const bagMissing = !!choices.bagId && bags.isSuccess && !requested

  const myGrinders: MyGrinder[] = grinders.data ?? []
  const lastGrinderId = recent.map((d) => d.choices.grinderId).find((id) => id && myGrinders.some((g) => g.grinder.id === id))
  const grinder: MyGrinder | undefined =
    myGrinders.find((g) => g.grinder.id === (choices.grinderId ?? lastGrinderId)) ?? myGrinders[0]

  const myFilters: MyFilter[] = filters.data ?? []
  const lastFilterId = recent.map((d) => d.choices.filterId).find((id) => id === 'none' || (id && myFilters.some((f) => f.filter.id === id)))
  const wanted = choices.filterId ?? lastFilterId
  const filter: MyFilter | null =
    wanted === 'none' ? null : ((wanted ? myFilters.find((f) => f.filter.id === wanted) : undefined) ?? myFilters.find((f) => f.isDefault) ?? null)

  return { bags, drafts, active, grinders, filters, profile, bag, bagMissing, myGrinders, grinder, myFilters, filter }
}
