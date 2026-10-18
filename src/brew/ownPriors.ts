import { suggest } from '../../engine/suggest.ts'
import type { PriorRecipe } from '../../engine/types.ts'
import { tastesOf, type Bag, type Draft, type FriendRecipe, type LockedRecipe, type MyFilter } from '../data/types'
import { beanTraits, buildSuggestInput } from './buildInput'

interface Sources {
  recipes: LockedRecipe[]
  drafts: Draft[]
  bags: Bag[]
  filters: MyFilter[]
  asOf: string
}

/**
 * Your own recipes, as data for the suggestion. A locked recipe is the basis for its bean. Your
 * working recipe replaces it only when the last brew of it was marked good and is newer than the
 * lock: a brew that tasted sour or weak is something to fix, not something to start from.
 */
export function ownPriors({ recipes, drafts, bags, filters, asOf }: Sources): PriorRecipe[] {
  const priors = new Map<string, PriorRecipe>()
  const bagFor = (beanId: string) => bags.find((bag) => bag.bean.id === beanId)

  for (const recipe of recipes) {
    const bag = bagFor(recipe.beanId)
    if (!bag) continue
    priors.set(`${recipe.beanId}:${recipe.method}`, {
      method: recipe.method,
      beanId: recipe.beanId,
      bean: beanTraits(bag.bean),
      tempC: recipe.snapshot.recipe.tempC,
      grindUm: recipe.snapshot.recipe.grindUm,
    })
  }

  for (const draft of drafts) {
    const bag = bagFor(draft.beanId)
    const brewed = draft.lastBrew
    const tastes = brewed ? tastesOf(brewed) : []
    if (!bag || !brewed || tastes.length !== 1 || tastes[0] !== 'good') continue
    const locked = recipes.find((r) => r.beanId === draft.beanId && r.method === draft.method)
    if (locked && new Date(brewed.brewedAt) <= new Date(locked.lockedAt)) continue
    const filter = filters.find((f) => f.filter.id === draft.choices.filterId)?.filter ?? filters.find((f) => f.isDefault)?.filter ?? null
    // Worked out without any context, so a recipe cannot be its own basis.
    const { recipe } = suggest(buildSuggestInput(bag, draft.choices, filter, asOf))
    priors.set(`${draft.beanId}:${draft.method}`, {
      method: draft.method,
      beanId: draft.beanId,
      bean: beanTraits(bag.bean),
      tempC: recipe.tempC,
      grindUm: recipe.grindUm,
    })
  }
  return [...priors.values()]
}

/** Friends' locked recipes as suggestion data. Their grind is already in microns, so it needs no converting. */
export function friendPriors(recipes: FriendRecipe[]): PriorRecipe[] {
  return recipes.map((recipe) => ({
    method: recipe.method,
    beanId: recipe.bean.id,
    bean: beanTraits(recipe.bean),
    tempC: recipe.snapshot.recipe.tempC,
    grindUm: recipe.snapshot.recipe.grindUm,
    from: recipe.friend.name,
  }))
}
