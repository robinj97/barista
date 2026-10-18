import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { shrinkPhoto } from '../beans/photo'
import { uniqueRoasters } from '../beans/roasters'
import { useToast } from '../components/toastContext'
import { useApi } from './ApiContext'
import { bagKey, draftKey, enqueue, flushOutbox, isNetworkError } from './outbox'
import type { AddBagInput, Bag, BagPatch, Draft, LockedRecipe, LockRecipeInput, NewFilter, Profile, ProfilePatch, SaveDraftInput } from './types'

export const keys = {
  profile: (userId: string) => ['profile', userId] as const,
  grinderCatalogue: ['grinders', 'catalogue'] as const,
  myGrinders: (userId: string) => ['grinders', 'mine', userId] as const,
  filterCatalogue: ['filters', 'catalogue'] as const,
  myFilters: (userId: string) => ['filters', 'mine', userId] as const,
}

function useUserId(): string {
  const { session } = useAuth()
  if (!session) throw new Error('Signed-in screens need a session')
  return session.user.id
}

export function useProfile() {
  const api = useApi()
  const userId = useUserId()
  return useQuery({ queryKey: keys.profile(userId), queryFn: () => api.getProfile(userId) })
}

/** Optimistic: the screen updates at once and rolls back if the save fails. */
export function useUpdateProfile() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  const key = keys.profile(userId)

  return useMutation({
    mutationFn: (patch: ProfilePatch) => api.updateProfile(userId, patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<Profile>(key)
      if (previous) client.setQueryData<Profile>(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })
}

export function useGrinderCatalogue() {
  const api = useApi()
  return useQuery({ queryKey: keys.grinderCatalogue, queryFn: () => api.listGrinderCatalogue(), staleTime: 5 * 60_000 })
}

export function useMyGrinders() {
  const api = useApi()
  const userId = useUserId()
  return useQuery({ queryKey: keys.myGrinders(userId), queryFn: () => api.listMyGrinders() })
}

export function useAddGrinder() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (grinderId: string) => api.addMyGrinder(grinderId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myGrinders(userId) }),
  })
}

export function useRemoveGrinder() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (grinderId: string) => api.removeMyGrinder(grinderId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myGrinders(userId) }),
  })
}

export function useFilterCatalogue() {
  const api = useApi()
  return useQuery({ queryKey: keys.filterCatalogue, queryFn: () => api.listFilterCatalogue(), staleTime: 60_000 })
}

export function useMyFilters() {
  const api = useApi()
  const userId = useUserId()
  return useQuery({ queryKey: keys.myFilters(userId), queryFn: () => api.listMyFilters() })
}

export function useAddFilter() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filterId: string) => api.addMyFilter(filterId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myFilters(userId) }),
  })
}

/** Creates the filter in the shared catalogue, then adds it to the user's list. */
export function useCreateAndAddFilter() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewFilter) => {
      const filter = await api.createFilter(input)
      await api.addMyFilter(filter.id)
      return filter
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.myFilters(userId) })
      void client.invalidateQueries({ queryKey: keys.filterCatalogue })
    },
  })
}

export function useSetDefaultFilter() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filterId: string) => api.setDefaultFilter(filterId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myFilters(userId) }),
  })
}

export function useRemoveFilter() {
  const api = useApi()
  const userId = useUserId()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filterId: string) => api.removeMyFilter(filterId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myFilters(userId) }),
  })
}

export const bagKeys = {
  mine: ['bags', 'mine'] as const,
  search: (query: string) => ['beans', 'search', query] as const,
  catalogue: ['beans', 'catalogue'] as const,
}

/** Distinct roasters already in the catalogue. Small today; paginate or search server-side if it grows. */
export function useRoasters() {
  const api = useApi()
  return useQuery({
    queryKey: ['beans', 'roasters'] as const,
    queryFn: async () => uniqueRoasters(await api.listRoasters()),
    staleTime: 5 * 60_000,
  })
}

export function useMyBags() {
  const api = useApi()
  return useQuery({ queryKey: bagKeys.mine, queryFn: () => api.listMyBags() })
}

/** The whole catalogue, alphabetical, for browsing and narrowing on the device as you type. */
export function useBeanCatalogue() {
  const api = useApi()
  return useQuery({
    queryKey: bagKeys.catalogue,
    queryFn: () => api.browseBeans(),
    staleTime: 5 * 60_000,
  })
}

/** Searches the shared catalogue once there are at least two characters. */
export function useBeanSearch(query: string) {
  const api = useApi()
  const trimmed = query.trim()
  return useQuery({
    queryKey: bagKeys.search(trimmed.toLowerCase()),
    queryFn: () => api.searchBeans(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  })
}

/**
 * Optimistic: the bag appears in the list at once. If saving fails it is removed again and a
 * message is shown. The same bag id makes a retry safe.
 */
export function useAddBag() {
  const api = useApi()
  const client = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ input }: { input: AddBagInput; optimistic: Bag }) => api.addBag(input),
    onMutate: async ({ optimistic }) => {
      await client.cancelQueries({ queryKey: bagKeys.mine })
      const previous = client.getQueryData<Bag[]>(bagKeys.mine)
      client.setQueryData<Bag[]>(bagKeys.mine, [optimistic, ...(previous ?? [])])
      return { previous }
    },
    onError: (_error, { optimistic }, context) => {
      client.setQueryData(bagKeys.mine, context?.previous ?? [])
      toast.show(`Couldn't add ${optimistic.bean.name}. Check your connection and try again.`)
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: bagKeys.mine })
      void client.invalidateQueries({ queryKey: ['beans', 'search'] })
      void client.invalidateQueries({ queryKey: ['beans', 'roasters'] })
    },
  })
}

export function useRemoveBag() {
  const api = useApi()
  const client = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (bagId: string) => api.removeBag(bagId),
    onError: () => toast.show("Couldn't remove that bag. Bags with brews can't be removed yet."),
    onSettled: () => client.invalidateQueries({ queryKey: bagKeys.mine }),
  })
}

/**
 * Changes how much is left in a bag or where you are with it. The bag updates on screen at once;
 * with no connection the change waits on the phone and is sent later.
 */
export function useUpdateBag() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ bagId, patch }: { bagId: string; patch: BagPatch }): Promise<SaveOutcome> => {
      try {
        await api.updateBag(bagId, patch)
        return 'saved'
      } catch (error) {
        if (!isNetworkError(error)) throw error
        enqueue({ key: bagKey(bagId), kind: 'bag', bagId, patch })
        return 'queued'
      }
    },
    onMutate: ({ bagId, patch }) => {
      client.setQueryData<Bag[]>(bagKeys.mine, (bags = []) => bags.map((bag) => (bag.id === bagId ? { ...bag, ...patch } : bag)))
    },
    onSettled: (outcome) => {
      if (outcome === 'saved') void client.invalidateQueries({ queryKey: bagKeys.mine })
    },
  })
}

const draftsKey = ['drafts'] as const
const recipesKey = ['recipes'] as const

export function useMyDrafts() {
  const api = useApi()
  return useQuery({ queryKey: draftsKey, queryFn: () => api.listMyDrafts() })
}

export function useMyRecipes() {
  const api = useApi()
  return useQuery({ queryKey: recipesKey, queryFn: () => api.listMyRecipes() })
}

/** Archives a locked recipe. It leaves your lists at once; if saving fails it comes back. */
export function useArchiveRecipe() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (recipeId: string) => api.archiveRecipe(recipeId),
    onMutate: async (recipeId) => {
      await client.cancelQueries({ queryKey: recipesKey })
      const previous = client.getQueryData<LockedRecipe[]>(recipesKey)
      client.setQueryData<LockedRecipe[]>(recipesKey, (list = []) => list.filter((r) => r.id !== recipeId))
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(recipesKey, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: recipesKey }),
  })
}

export type SaveOutcome = 'saved' | 'queued'

/**
 * Overwrites your working recipe for a bean. The screen sees the new draft at once. If the
 * connection is down it waits on the phone and is sent later.
 */
export function useSaveDraft() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveDraftInput): Promise<SaveOutcome> => {
      try {
        await api.saveDraft(input)
        return 'saved'
      } catch (error) {
        if (!isNetworkError(error)) throw error
        enqueue({ key: draftKey(input), kind: 'draft', input })
        return 'queued'
      }
    },
    onMutate: (input) => {
      client.setQueryData<Draft[]>(draftsKey, (drafts = []) => {
        const rest = drafts.filter((d) => !(d.beanId === input.beanId && d.method === input.method))
        const old = drafts.find((d) => d.beanId === input.beanId && d.method === input.method)
        return [...rest, { beanId: input.beanId, method: input.method, choices: input.choices, lastBrew: input.lastBrew ?? old?.lastBrew ?? null, updatedAt: new Date().toISOString() }]
      })
    },
    onSettled: (outcome) => {
      if (outcome === 'saved') void client.invalidateQueries({ queryKey: draftsKey })
    },
  })
}

/** Locks a brew in as your recipe; queued on the phone when offline, like drafts. */
export function useLockRecipe() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: LockRecipeInput): Promise<SaveOutcome> => {
      try {
        await api.lockRecipe(input)
        return 'saved'
      } catch (error) {
        if (!isNetworkError(error)) throw error
        enqueue({ key: `lock:${input.brewId}`, kind: 'lock', input })
        return 'queued'
      }
    },
    onSuccess: (outcome) => {
      if (outcome === 'saved') void client.invalidateQueries({ queryKey: recipesKey })
    },
  })
}

/** Sends anything saved on the phone while offline: when the app opens and whenever the connection returns. */
export function useFlushOutbox() {
  const api = useApi()
  const client = useQueryClient()
  useEffect(() => {
    let active = true
    const flush = () =>
      void flushOutbox(api).then((sent) => {
        if (!active || sent === 0) return
        void client.invalidateQueries({ queryKey: draftsKey })
        void client.invalidateQueries({ queryKey: recipesKey })
        void client.invalidateQueries({ queryKey: bagKeys.mine })
      })
    flush()
    window.addEventListener('online', flush)
    return () => {
      active = false
      window.removeEventListener('online', flush)
    }
  }, [api, client])
}

const friendsKey = ['friends'] as const
const invitesKey = ['invites'] as const

export function useFriends() {
  const api = useApi()
  return useQuery({ queryKey: friendsKey, queryFn: () => api.listFriends() })
}

export function useMyInvites() {
  const api = useApi()
  return useQuery({ queryKey: invitesKey, queryFn: () => api.listMyInvites() })
}

/** Makes an invite link. The token comes back once, so the caller has to show it straight away. */
export function useCreateInvite() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.createInvite(),
    onSettled: () => client.invalidateQueries({ queryKey: invitesKey }),
  })
}

export function useCancelInvite() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => api.cancelInvite(inviteId),
    onMutate: async (inviteId) => {
      await client.cancelQueries({ queryKey: invitesKey })
      const previous = client.getQueryData<{ id: string }[]>(invitesKey)
      client.setQueryData<{ id: string }[]>(invitesKey, (list = []) => list.filter((i) => i.id !== inviteId))
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(invitesKey, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: invitesKey }),
  })
}

export function usePeekInvite(token: string) {
  const api = useApi()
  return useQuery({ queryKey: ['invite', token], queryFn: () => api.peekInvite(token), retry: false, staleTime: Infinity })
}

export function useAcceptInvite() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => api.acceptInvite(token),
    onSuccess: (_result, token) => {
      client.removeQueries({ queryKey: ['invite', token] })
      void client.invalidateQueries({ queryKey: friendsKey })
      // Being friends changes which recipes you can see.
      void client.invalidateQueries({ queryKey: ['beans', 'search'] })
      void client.invalidateQueries({ queryKey: ['friend-recipes'] })
    },
  })
}

/** Locked recipes your friends have made. */
export function useFriendRecipes() {
  const api = useApi()
  return useQuery({ queryKey: ['friend-recipes'], queryFn: () => api.listFriendRecipes() })
}

/** Shrinks a bag photo on the device, then has the server read the label. */
export function useScanBag() {
  const api = useApi()
  return useMutation({
    mutationFn: async (photo: Blob) => api.scanBag(await shrinkPhoto(photo)),
  })
}

/** Ends a friendship. They leave your list at once; their recipes disappear from your Library and suggestions. */
export function useRemoveFriend() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (friendId: string) => api.removeFriend(friendId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['friends'] })
      void client.invalidateQueries({ queryKey: ['friend-recipes'] })
      void client.invalidateQueries({ queryKey: ['beans', 'search'] })
    },
  })
}
