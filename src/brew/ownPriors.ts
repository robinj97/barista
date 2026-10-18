import { suggest } from '../../engine/suggest.ts'
import type { PriorRecipe } from '../../engine/types.ts'
import { tastesOf, type Bag, type Bean, type Draft, type FriendRecipe, type LockedRecipe, type LockedRecipeBase, type Method, type MyFilter } from '../data/types'
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

  for (const recipe of recipes) priors.set(`${recipe.bean.id}:${recipe.method}`, priorFrom(recipe))

  for (const draft of drafts) {
    const bag = bagFor(draft.beanId)
    const brewed = draft.lastBrew
    const tastes = brewed ? tastesOf(brewed) : []
    if (!bag || !brewed || tastes.length !== 1 || tastes[0] !== 'good') continue
    const locked = recipes.find((r) => r.bean.id === draft.beanId && r.method === draft.method)
    if (locked && new Date(brewed.brewedAt) <= new Date(locked.lockedAt)) continue
    const filter = filters.find((f) => f.filter.id === draft.choices.filterId)?.filter ?? filters.find((f) => f.isDefault)?.filter ?? null
    // Worked out without any context, so a recipe cannot be its own basis.
    const { recipe } = suggest(buildSuggestInput(bag, draft.choices, filter, asOf))
    priors.set(`${draft.beanId}:${draft.method}`, makePrior(draft.method, bag.bean, recipe.tempC, recipe.grindUm))
  }
  return [...priors.values()]
}

/** What the engine learns from one recipe: the bean it is for, and its temperature and grind. `from` names a friend. */
function makePrior(method: Method, bean: Bean, tempC: number, grindUm: number, from?: string): PriorRecipe {
  return { method, beanId: bean.id, bean: beanTraits(bean), tempC, grindUm, ...(from ? { from } : {}) }
}

/** A locked recipe's temperature and grind are already in microns, whoever's grinder they came from. */
const priorFrom = (recipe: LockedRecipeBase, from?: string): PriorRecipe =>
  makePrior(recipe.method, recipe.bean, recipe.snapshot.recipe.tempC, recipe.snapshot.recipe.grindUm, from)

/** Friends' locked recipes as suggestion data. */
export const friendPriors = (recipes: FriendRecipe[]): PriorRecipe[] => recipes.map((recipe) => priorFrom(recipe, recipe.friend.name))
