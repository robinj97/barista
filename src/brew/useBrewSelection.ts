import { useMyBags, useMyFilters, useMyGrinders, useProfile } from '../data/hooks'
import type { Bag, MyFilter, MyGrinder } from '../data/types'
import type { BrewChoices } from './params'

/**
 * Resolves the choices in the URL against your own beans and gear. Anything not chosen falls
 * back sensibly: the newest bag, your first grinder, your default filter.
 */
export function useBrewSelection(choices: BrewChoices) {
  const bags = useMyBags()
  const grinders = useMyGrinders()
  const filters = useMyFilters()
  const profile = useProfile()

  const requested = choices.bagId ? bags.data?.find((bag) => bag.id === choices.bagId) : undefined
  const bag: Bag | undefined = requested ?? bags.data?.[0]
  /** A bag was named in the link but is not in your beans. */
  const bagMissing = !!choices.bagId && bags.isSuccess && !requested

  const myGrinders: MyGrinder[] = grinders.data ?? []
  const grinder: MyGrinder | undefined =
    (choices.grinderId ? myGrinders.find((g) => g.grinder.id === choices.grinderId) : undefined) ?? myGrinders[0]

  const myFilters: MyFilter[] = filters.data ?? []
  const filter: MyFilter | null =
    choices.filterId === 'none'
      ? null
      : ((choices.filterId ? myFilters.find((f) => f.filter.id === choices.filterId) : undefined) ??
        myFilters.find((f) => f.isDefault) ??
        null)

  return { bags, grinders, filters, profile, bag, bagMissing, myGrinders, grinder, myFilters, filter }
}
