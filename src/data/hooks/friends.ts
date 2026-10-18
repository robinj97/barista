import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFriendsApi } from '../ApiContext'
import type { PendingInvite } from '../types'
import { keys } from './keys'
import { useInvalidate, useOptimisticMutation } from './mutations'

export function useFriends() {
  const api = useFriendsApi()
  return useQuery({ queryKey: keys.friends, queryFn: () => api.listFriends() })
}

export function useMyInvites() {
  const api = useFriendsApi()
  return useQuery({ queryKey: keys.invites, queryFn: () => api.listMyInvites() })
}

/** Locked recipes your friends have made. */
export function useFriendRecipes() {
  const api = useFriendsApi()
  return useQuery({ queryKey: keys.friendRecipes, queryFn: () => api.listFriendRecipes() })
}

/** Makes an invite link. The token comes back once, so the caller has to show it straight away. */
export function useCreateInvite() {
  const api = useFriendsApi()
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: () => api.createInvite(), onSettled: () => invalidate(keys.invites) })
}

export function useCancelInvite() {
  const api = useFriendsApi()
  return useOptimisticMutation<string, PendingInvite[]>({
    queryKey: keys.invites,
    mutationFn: (inviteId) => api.cancelInvite(inviteId),
    apply: (list, inviteId) => (list ?? []).filter((invite) => invite.id !== inviteId),
    invalidate: () => [keys.invites],
  })
}

export function usePeekInvite(token: string) {
  const api = useFriendsApi()
  return useQuery({ queryKey: keys.invite(token), queryFn: () => api.peekInvite(token), retry: false, staleTime: Infinity })
}

/** Becoming (or ceasing to be) friends changes which recipes you can see. */
function useFriendshipChange<TInput, TResult>(change: (input: TInput) => Promise<TResult>, forgetInvite?: (input: TInput) => readonly string[]) {
  const client = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: change,
    onSuccess: (_result, input) => {
      if (forgetInvite) client.removeQueries({ queryKey: forgetInvite(input) })
      void invalidate(keys.friends, keys.friendRecipes, keys.beans.searches)
    },
  })
}

export function useAcceptInvite() {
  const api = useFriendsApi()
  return useFriendshipChange((token: string) => api.acceptInvite(token), (token) => keys.invite(token))
}

/** Ends a friendship. They leave your list at once; their recipes disappear from your Library and suggestions. */
export function useRemoveFriend() {
  const api = useFriendsApi()
  return useFriendshipChange((friendId: string) => api.removeFriend(friendId))
}
