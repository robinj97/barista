import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { StoredSuggestion } from '../../../supabase/functions/suggest-tweak/suggest.ts'
import { useApi, useRecipesApi } from '../ApiContext'
import { draftKey, flushOutbox, saveOrQueue, type SaveOutcome } from '../outbox'
import { SuggestError, type Draft, type LockedRecipe, type LockRecipeInput, type Method, type SaveDraftInput } from '../types'
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
        { beanId: input.beanId, method: input.method, choices: input.choices, lastBrew: input.lastBrew ?? old?.lastBrew ?? null, suggestion: old?.suggestion ?? null, updatedAt: new Date().toISOString() },
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

const withSuggestion = (beanId: string, method: Method, change: (old: StoredSuggestion | null | undefined) => StoredSuggestion | null) => (drafts: Draft[] = []) =>
  drafts.map((d) => (d.beanId === beanId && d.method === method ? { ...d, suggestion: change(d.suggestion) } : d))

/**
 * Asks for a suggestion for the draft's last brew. If the server hasn't got that brew yet (it was
 * logged offline), the waiting writes are sent first and it asks once more.
 */
export function useSuggestTweak() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ beanId, brewedAt }: { beanId: string; brewedAt: string }) => {
      try {
        return await api.suggestTweak(beanId, brewedAt)
      } catch (error) {
        if (!(error instanceof SuggestError) || error.reason !== 'stale') throw error
        await flushOutbox(api)
        return api.suggestTweak(beanId, brewedAt)
      }
    },
    onSuccess: ({ suggestion }, { beanId }) => {
      client.setQueryData<Draft[]>(keys.drafts, withSuggestion(beanId, 'v60', () => suggestion))
    },
  })
}

/** Records Apply (a time) or Undo (null) on the suggestion. Best effort: a failed save is ignored. */
export function useSetSuggestionApplied() {
  const api = useRecipesApi()
  return useOptimisticMutation<{ beanId: string; appliedAt: string | null }, Draft[]>({
    queryKey: keys.drafts,
    mutationFn: ({ beanId, appliedAt }) => api.setSuggestionApplied(beanId, 'v60', appliedAt).catch(() => {}),
    apply: (drafts, { beanId, appliedAt }) => withSuggestion(beanId, 'v60', (old) => (old ? { ...old, appliedAt } : null))(drafts),
    invalidate: () => [keys.drafts],
  })
}

/** When a suggestion is applied: now. Kept out of components so rendering stays pure. */
export const appliedNow = () => new Date().toISOString()

