import { useMutation, useQuery } from '@tanstack/react-query'
import { useGearApi } from '../ApiContext'
import type { NewFilter } from '../types'
import { keys } from './keys'
import { useInvalidate } from './mutations'
import { useUserId } from './shared'

export function useGrinderCatalogue() {
  const api = useGearApi()
  return useQuery({ queryKey: keys.grinders.catalogue, queryFn: () => api.listGrinderCatalogue(), staleTime: 5 * 60_000 })
}

export function useMyGrinders() {
  const api = useGearApi()
  const userId = useUserId()
  return useQuery({ queryKey: keys.grinders.mine(userId), queryFn: () => api.listMyGrinders() })
}

/** A change to your own grinder list, then a refetch of it. */
function useGrinderListChange<TInput>(change: (input: TInput) => Promise<void>) {
  const userId = useUserId()
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: change, onSettled: () => invalidate(keys.grinders.mine(userId)) })
}

export function useAddGrinder() {
  const api = useGearApi()
  return useGrinderListChange((grinderId: string) => api.addMyGrinder(grinderId))
}

export function useRemoveGrinder() {
  const api = useGearApi()
  return useGrinderListChange((grinderId: string) => api.removeMyGrinder(grinderId))
}

export function useFilterCatalogue() {
  const api = useGearApi()
  return useQuery({ queryKey: keys.filters.catalogue, queryFn: () => api.listFilterCatalogue(), staleTime: 60_000 })
}

export function useMyFilters() {
  const api = useGearApi()
  const userId = useUserId()
  return useQuery({ queryKey: keys.filters.mine(userId), queryFn: () => api.listMyFilters() })
}

/** A change to your own filter list, then a refetch of it (and of the catalogue when a filter was created). */
function useFilterListChange<TInput, TResult = void>(change: (input: TInput) => Promise<TResult>, alsoCatalogue = false) {
  const userId = useUserId()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: change,
    onSettled: () => invalidate(keys.filters.mine(userId), ...(alsoCatalogue ? [keys.filters.catalogue] : [])),
  })
}

export function useAddFilter() {
  const api = useGearApi()
  return useFilterListChange((filterId: string) => api.addMyFilter(filterId))
}

/** Creates the filter in the shared catalogue, then adds it to the user's list. */
export function useCreateAndAddFilter() {
  const api = useGearApi()
  return useFilterListChange(async (input: NewFilter) => {
    const filter = await api.createFilter(input)
    await api.addMyFilter(filter.id)
    return filter
  }, true)
}

export function useSetDefaultFilter() {
  const api = useGearApi()
  return useFilterListChange((filterId: string) => api.setDefaultFilter(filterId))
}

export function useRemoveFilter() {
  const api = useGearApi()
  return useFilterListChange((filterId: string) => api.removeMyFilter(filterId))
}
