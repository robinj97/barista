import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import type { CalibrationSource } from '../../engine/grinder.ts'
import type { Api, CatalogueGrinder, FilterRow, MyFilter, MyGrinder, Profile } from './types'

type GrinderRow = Database['public']['Tables']['grinders']['Row']
type CalibrationRow = Pick<Database['public']['Tables']['grinder_calibration']['Row'], 'setting' | 'microns' | 'source'>
type GrinderWithPoints = GrinderRow & { grinder_calibration: CalibrationRow[] }

const GRINDER_SELECT = '*, grinder_calibration(setting, microns, source)'

function toGrinder(row: GrinderWithPoints): CatalogueGrinder {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    unitLabel: row.unit_label,
    step: row.setting_step,
    min: row.min_setting,
    max: row.max_setting,
    points: row.grinder_calibration.map((point) => ({
      setting: point.setting,
      microns: point.microns,
      source: point.source as CalibrationSource,
    })),
  }
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const session: Session | null = data.session
  if (!session) throw new Error('Not signed in')
  return session.user.id
}

export const supabaseApi: Api = {
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

  async listGrinderCatalogue() {
    const { data, error } = await supabase
      .from('grinders')
      .select(GRINDER_SELECT)
      .order('brand')
      .order('model')
    fail(error)
    return (data as GrinderWithPoints[]).map(toGrinder)
  },

  async listMyGrinders(): Promise<MyGrinder[]> {
    const { data, error } = await supabase
      .from('user_grinders')
      .select(`nickname, offset_um, grinders(${GRINDER_SELECT})`)
    fail(error)
    return (data as unknown as { nickname: string | null; offset_um: number; grinders: GrinderWithPoints }[]).map(
      (row) => ({ grinder: toGrinder(row.grinders), nickname: row.nickname, offsetUm: row.offset_um }),
    )
  },

  async addMyGrinder(grinderId) {
    const { error } = await supabase.from('user_grinders').insert({ grinder_id: grinderId })
    fail(error)
  },

  async removeMyGrinder(grinderId) {
    const { error } = await supabase.from('user_grinders').delete().eq('grinder_id', grinderId)
    fail(error)
  },

  async listFilterCatalogue() {
    const { data, error } = await supabase.from('filters').select('*').order('brand').order('model')
    fail(error)
    return data
  },

  async listMyFilters(): Promise<MyFilter[]> {
    const { data, error } = await supabase.from('user_filters').select('nickname, is_default, filters(*)')
    fail(error)
    return (data as unknown as { nickname: string | null; is_default: boolean; filters: FilterRow }[]).map((row) => ({
      filter: row.filters,
      nickname: row.nickname,
      isDefault: row.is_default,
    }))
  },

  async addMyFilter(filterId) {
    const { count, error: countError } = await supabase
      .from('user_filters')
      .select('filter_id', { count: 'exact', head: true })
    fail(countError)
    const { error } = await supabase
      .from('user_filters')
      .insert({ filter_id: filterId, is_default: (count ?? 0) === 0 })
    fail(error)
  },

  async createFilter(input) {
    const userId = await currentUserId()
    const row = {
      brand: input.brand.trim(),
      model: input.model.trim(),
      size: input.size?.trim() || null,
      material: input.material,
      flow_class: input.flowClass ?? null,
      created_by: userId,
    }
    const { data, error } = await supabase.from('filters').insert(row).select('*').single()
    if (!error) return data

    // Unique violation: the same filter is already in the catalogue under another spelling.
    if (error.code === '23505') {
      const { data: all, error: listError } = await supabase.from('filters').select('*')
      fail(listError)
      const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
      const match = all.find(
        (f) => key(f.brand + f.model) === key(row.brand + row.model) && (f.size ?? null) === row.size,
      )
      if (match) return match
    }
    throw new Error(error.message)
  },

  async setDefaultFilter(filterId) {
    const { error } = await supabase.rpc('set_default_filter', { target: filterId })
    fail(error)
  },

  async removeMyFilter(filterId) {
    const { error } = await supabase.from('user_filters').delete().eq('filter_id', filterId)
    fail(error)
  },
}
