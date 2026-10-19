import { supabase } from '../../lib/supabase'
import type { ProfileApi } from '../api'
import type { Feature, Profile } from '../types'
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

  async listMyFeatures() {
    const { data, error } = await supabase.from('feature_access').select('feature')
    fail(error)
    return data.map((row) => row.feature as Feature)
  },
}
