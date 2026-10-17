import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { useApi } from './ApiContext'
import type { NewFilter, Profile, ProfilePatch } from './types'

export const keys = {
  profile: (userId: string) => ['profile', userId] as const,
  grinderCatalogue: ['grinders', 'catalogue'] as const,
  myGrinders: ['grinders', 'mine'] as const,
  filterCatalogue: ['filters', 'catalogue'] as const,
  myFilters: ['filters', 'mine'] as const,
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
  return useQuery({ queryKey: keys.myGrinders, queryFn: () => api.listMyGrinders() })
}

export function useAddGrinder() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (grinderId: string) => api.addMyGrinder(grinderId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myGrinders }),
  })
}

export function useRemoveGrinder() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (grinderId: string) => api.removeMyGrinder(grinderId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myGrinders }),
  })
}

export function useFilterCatalogue() {
  const api = useApi()
  return useQuery({ queryKey: keys.filterCatalogue, queryFn: () => api.listFilterCatalogue(), staleTime: 60_000 })
}

export function useMyFilters() {
  const api = useApi()
  return useQuery({ queryKey: keys.myFilters, queryFn: () => api.listMyFilters() })
}

export function useAddFilter() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filterId: string) => api.addMyFilter(filterId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myFilters }),
  })
}

/** Creates the filter in the shared catalogue, then adds it to the user's list. */
export function useCreateAndAddFilter() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewFilter) => {
      const filter = await api.createFilter(input)
      await api.addMyFilter(filter.id)
      return filter
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.myFilters })
      void client.invalidateQueries({ queryKey: keys.filterCatalogue })
    },
  })
}

export function useSetDefaultFilter() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filterId: string) => api.setDefaultFilter(filterId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myFilters }),
  })
}

export function useRemoveFilter() {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filterId: string) => api.removeMyFilter(filterId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.myFilters }),
  })
}
