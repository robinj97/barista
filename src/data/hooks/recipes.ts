import { useMutation, useQuery } from '@tanstack/react-query'
import { useRecipesApi } from '../ApiContext'
import { draftKey, saveOrQueue, type SaveOutcome } from '../outbox'
import type { Draft, LockedRecipe, LockRecipeInput, SaveDraftInput } from '../types'
import { keys } from './keys'
import { useInvalidate, useOptimisticMutation } from './mutations'

export function useMyDrafts() {
  const api = useRecipesApi()
  return useQuery({ queryKey: keys.drafts, queryFn: () => api.listMyDrafts() })
}

export function useMyRecipes() {
  const api = useRecipesApi()
  return useQuery({ queryKey: keys.recipes, queryFn: () => api.listMyRecipes() })
}

/** Archives a locked recipe. It leaves your lists at once; if saving fails it comes back. */
export function useArchiveRecipe() {
  const api = useRecipesApi()
  return useOptimisticMutation<string, LockedRecipe[]>({
    queryKey: keys.recipes,
    mutationFn: (recipeId) => api.archiveRecipe(recipeId),
    apply: (list, recipeId) => (list ?? []).filter((recipe) => recipe.id !== recipeId),
    invalidate: () => [keys.recipes],
  })
}

/**
 * Overwrites your working recipe for a bean. The screen sees the new draft at once. If the
 * connection is down it waits on the phone and is sent later.
 */
export function useSaveDraft() {
  const api = useRecipesApi()
  return useOptimisticMutation<SaveDraftInput, Draft[], SaveOutcome>({
    queryKey: keys.drafts,
    mutationFn: (input) => saveOrQueue(() => api.saveDraft(input), { key: draftKey(input), kind: 'draft', input }),
    apply: (drafts = [], input) => {
      const same = (d: Draft) => d.beanId === input.beanId && d.method === input.method
      const old = drafts.find(same)
      return [
        ...drafts.filter((d) => !same(d)),
        { beanId: input.beanId, method: input.method, choices: input.choices, lastBrew: input.lastBrew ?? old?.lastBrew ?? null, updatedAt: new Date().toISOString() },
      ]
    },
    invalidate: (outcome) => (outcome === 'queued' ? [] : [keys.drafts]),
  })
}

/** Locks a brew in as your recipe; queued on the phone when offline, like drafts. */
export function useLockRecipe() {
  const api = useRecipesApi()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: LockRecipeInput): Promise<SaveOutcome> =>
      saveOrQueue(() => api.lockRecipe(input), { key: `lock:${input.brewId}`, kind: 'lock', input }),
    onSuccess: (outcome) => {
      if (outcome === 'saved') void invalidate(keys.recipes)
    },
  })
}
