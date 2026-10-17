import { useMemo } from 'react'
import type { PriorRecipe } from '../../engine/types.ts'
import { useMyBags, useMyDrafts, useMyFilters, useMyRecipes } from '../data/hooks'
import { ownPriors } from './ownPriors'

/** Your own recipes as suggestion data. `pending` is true until they are loaded, so a screen can wait instead of flashing a different recipe. */
export function useOwnPriors(asOf: string): { priors: PriorRecipe[]; pending: boolean } {
  const bags = useMyBags()
  const recipes = useMyRecipes()
  const drafts = useMyDrafts()
  const filters = useMyFilters()
  const pending = recipes.isPending || drafts.isPending
  const priors = useMemo(
    () => ownPriors({ recipes: recipes.data ?? [], drafts: drafts.data ?? [], bags: bags.data ?? [], filters: filters.data ?? [], asOf }),
    [recipes.data, drafts.data, bags.data, filters.data, asOf],
  )
  return { priors, pending }
}
