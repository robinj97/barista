import { useMemo } from 'react'
import type { PriorRecipe } from '../../engine/types.ts'
import { useFriendRecipes, useMyBags, useMyDrafts, useMyFilters, useMyRecipes } from '../data/hooks'
import { friendPriors, ownPriors } from './ownPriors'

/**
 * The recipes a suggestion learns from: yours, and your friends'. `pending` is true until they are
 * loaded, so a screen can wait instead of flashing a different recipe.
 */
export function usePriors(asOf: string): { context: { own: PriorRecipe[]; friends: PriorRecipe[] }; pending: boolean } {
  const bags = useMyBags()
  const recipes = useMyRecipes()
  const drafts = useMyDrafts()
  const filters = useMyFilters()
  const friendRecipes = useFriendRecipes()
  const pending = recipes.isPending || drafts.isPending || friendRecipes.isPending
  const context = useMemo(
    () => ({
      own: ownPriors({ recipes: recipes.data ?? [], drafts: drafts.data ?? [], bags: bags.data ?? [], filters: filters.data ?? [], asOf }),
      friends: friendPriors(friendRecipes.data ?? []),
    }),
    [recipes.data, drafts.data, bags.data, filters.data, friendRecipes.data, asOf],
  )
  return { context, pending }
}
