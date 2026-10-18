import { supabase } from '../../lib/supabase'
import type { ProfileApi } from '../api'
import type { Profile } from '../types'
import { fail } from './shared'

export const profileApi: ProfileApi = {
  async getProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    fail(error)
    return data as Profile
  },

  async updateProfile(userId, patch) {
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single()
    fail(error)
    return data as Profile
  },

}
