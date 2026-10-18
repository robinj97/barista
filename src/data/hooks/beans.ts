import { useMutation, useQuery } from '@tanstack/react-query'
import { shrinkPhoto } from '../../beans/photo'
import { uniqueRoasters } from '../../beans/roasters'
import { useToast } from '../../components/toastContext'
import { useBeansApi } from '../ApiContext'
import { saveOrQueue, bagKey, type SaveOutcome } from '../outbox'
import type { AddBagInput, Bag, BagPatch } from '../types'
import { keys } from './keys'
import { useInvalidate, useOptimisticMutation } from './mutations'

/** Distinct roasters already in the catalogue. Small today; paginate or search server-side if it grows. */
export function useRoasters() {
  const api = useBeansApi()
  return useQuery({
    queryKey: keys.beans.roasters,
    queryFn: async () => uniqueRoasters(await api.listRoasters()),
    staleTime: 5 * 60_000,
  })
}

export function useMyBags() {
  const api = useBeansApi()
  return useQuery({ queryKey: keys.bags, queryFn: () => api.listMyBags() })
}

/** The whole catalogue, alphabetical, for browsing and narrowing on the device as you type. */
export function useBeanCatalogue() {
  const api = useBeansApi()
  return useQuery({ queryKey: keys.beans.catalogue, queryFn: () => api.browseBeans(), staleTime: 5 * 60_000 })
}

/** Searches the shared catalogue once there are at least two characters. */
export function useBeanSearch(query: string) {
  const api = useBeansApi()
  const trimmed = query.trim()
  return useQuery({
    queryKey: keys.beans.search(trimmed.toLowerCase()),
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
  const api = useBeansApi()
  const toast = useToast()
  return useOptimisticMutation<{ input: AddBagInput; optimistic: Bag }, Bag[]>({
    queryKey: keys.bags,
    mutationFn: ({ input }) => api.addBag(input),
    apply: (current, { optimistic }) => [optimistic, ...(current ?? [])],
    invalidate: () => [keys.bags, keys.beans.searches, keys.beans.roasters],
    onFailure: (_error, { optimistic }) => toast.show(`Couldn't add ${optimistic.bean.name}. Check your connection and try again.`),
  })
}

export function useRemoveBag() {
  const api = useBeansApi()
  const invalidate = useInvalidate()
  const toast = useToast()
  return useMutation({
    mutationFn: (bagId: string) => api.removeBag(bagId),
    onError: () => toast.show("Couldn't remove that bag. Bags with brews can't be removed yet."),
    onSettled: () => invalidate(keys.bags),
  })
}

/**
 * Changes how much is left in a bag or where you are with it. The bag updates on screen at once;
 * with no connection the change waits on the phone and is sent later.
 */
export function useUpdateBag() {
  const api = useBeansApi()
  return useOptimisticMutation<{ bagId: string; patch: BagPatch }, Bag[], SaveOutcome>({
    queryKey: keys.bags,
    mutationFn: ({ bagId, patch }) => saveOrQueue(() => api.updateBag(bagId, patch), { key: bagKey(bagId), kind: 'bag', bagId, patch }),
    apply: (bags, { bagId, patch }) => bags?.map((bag) => (bag.id === bagId ? { ...bag, ...patch } : bag)),
    // A save waiting on the phone keeps the optimistic bag; anything else refetches the truth.
    invalidate: (outcome) => (outcome === 'queued' ? [] : [keys.bags]),
  })
}

/** Shrinks a bag photo on the device, then has the server read the label. */
export function useScanBag() {
  const api = useBeansApi()
  return useMutation({ mutationFn: async (photo: Blob) => api.scanBag(await shrinkPhoto(photo)) })
}
