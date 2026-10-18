import { useQuery } from '@tanstack/react-query'
import { useProfileApi } from '../ApiContext'
import type { Profile, ProfilePatch } from '../types'
import { keys } from './keys'
import { useOptimisticMutation } from './mutations'
import { useUserId } from './shared'

export function useProfile() {
  const api = useProfileApi()
  const userId = useUserId()
  return useQuery({ queryKey: keys.profile(userId), queryFn: () => api.getProfile(userId) })
}

/** Optimistic: the screen updates at once and rolls back if the save fails. */
export function useUpdateProfile() {
  const api = useProfileApi()
  const userId = useUserId()
  return useOptimisticMutation<ProfilePatch, Profile, Profile>({
    queryKey: keys.profile(userId),
    mutationFn: (patch) => api.updateProfile(userId, patch),
    apply: (current, patch) => (current ? { ...current, ...patch } : current),
    invalidate: () => [keys.profile(userId)],
  })
}

