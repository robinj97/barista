import { supabase } from '../../lib/supabase'
import type { FriendsApi } from '../api'
import type { Friend, FriendRecipe, InviterPreview, PendingInvite } from '../types'
import { loadLockedRows } from './lockedRows'
import { currentUserId, fail } from './shared'

export const friendsApi: FriendsApi = {
  async listFriends(): Promise<Friend[]> {
    const me = await currentUserId()
    const { data: rows, error } = await supabase.from('friendships').select('user_a, user_b, created_at')
    fail(error)
    const others = rows.map((r) => (r.user_a === me ? r.user_b : r.user_a))
    if (others.length === 0) return []
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', others)
    fail(profileError)
    return rows
      .map((row) => {
        const id = row.user_a === me ? row.user_b : row.user_a
        const profile = profiles.find((p) => p.id === id)
        return { id, name: profile?.display_name ?? 'Barista user', avatarUrl: profile?.avatar_url ?? null, since: row.created_at }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  async removeFriend(friendId) {
    const me = await currentUserId()
    // A friendship is one row with the smaller id first.
    const [a, b] = me < friendId ? [me, friendId] : [friendId, me]
    const { error } = await supabase.from('friendships').delete().eq('user_a', a).eq('user_b', b)
    fail(error)
  },

  async listMyInvites(): Promise<PendingInvite[]> {
    const { data, error } = await supabase
      .from('invites')
      .select('token_hash, expires_at')
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
    fail(error)
    return data.map((row) => ({ id: row.token_hash, expiresAt: row.expires_at }))
  },

  async createInvite() {
    const { data, error } = await supabase.rpc('create_invite')
    fail(error)
    return data
  },

  async cancelInvite(inviteId) {
    const { error } = await supabase.rpc('cancel_invite', { p_token_hash: inviteId })
    fail(error)
  },

  async peekInvite(token): Promise<InviterPreview> {
    const { data, error } = await supabase.rpc('peek_invite', { p_token: token })
    fail(error)
    const preview = data as { display_name: string; avatar_url: string | null }
    return { displayName: preview.display_name, avatarUrl: preview.avatar_url }
  },

  async acceptInvite(token): Promise<InviterPreview> {
    const { data, error } = await supabase.rpc('accept_invite', { token })
    fail(error)
    const result = data as { display_name: string }
    return { displayName: result.display_name, avatarUrl: null }
  },
  async listFriendRecipes(): Promise<FriendRecipe[]> {
    const rows = await loadLockedRows('friends')
    if (rows.length === 0) return []
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', [...new Set(rows.map((r) => r.ownerId))])
    fail(error)
    return rows
      .map(({ ownerId, versionId: _version, ...recipe }) => {
        const owner = profiles.find((p) => p.id === ownerId)
        return { ...recipe, friend: { id: ownerId, name: owner?.display_name ?? 'A friend', avatarUrl: owner?.avatar_url ?? null } }
      })
      .sort((a, b) => b.lockedAt.localeCompare(a.lockedAt))
  },
}
