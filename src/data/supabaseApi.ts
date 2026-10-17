import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import type { CalibrationSource } from '../../engine/grinder.ts'
import {
  byBrandModel,
  filterMatchKey,
  type Api,
  type Bag,
  type BagStatus,
  type Bean,
  type BeanMatch,
  type CatalogueGrinder,
  type FilterRow,
  type MyFilter,
  type MyGrinder,
  type Profile,
  type RoastLevel,
} from './types'

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

type BeanRow = Database['public']['Tables']['beans']['Row']

function toBean(row: BeanRow): Bean {
  return {
    id: row.id,
    roaster: row.roaster,
    name: row.name,
    origin: row.origin,
    region: row.region,
    producer: row.producer,
    variety: row.variety,
    process: row.process,
    altitudeM: row.altitude_m,
    roastLevel: row.roast_level as RoastLevel | null,
    roasterNotes: row.roaster_notes,
  }
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
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
    return (data as unknown as { nickname: string | null; offset_um: number; grinders: GrinderWithPoints }[])
      .map((row) => ({ grinder: toGrinder(row.grinders), nickname: row.nickname, offsetUm: row.offset_um }))
      .sort((a, b) => byBrandModel(a.grinder, b.grinder))
  },

  async addMyGrinder(grinderId) {
    // Already in the list (a double tap, or a picker that has not refetched yet): nothing to do.
    const { error } = await supabase
      .from('user_grinders')
      .upsert({ grinder_id: grinderId }, { onConflict: 'user_id,grinder_id', ignoreDuplicates: true })
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
    return (data as unknown as { nickname: string | null; is_default: boolean; filters: FilterRow }[])
      .map((row) => ({ filter: row.filters, nickname: row.nickname, isDefault: row.is_default }))
      .sort((a, b) => byBrandModel(a.filter, b.filter))
  },

  async addMyFilter(filterId) {
    // The database picks the default under a per-user lock, so quick adds cannot race.
    const { error } = await supabase.rpc('add_my_filter', { target: filterId })
    fail(error)
  },

  async createFilter(input) {
    const row = {
      brand: input.brand.trim(),
      model: input.model.trim(),
      size: input.size?.trim() || null,
      material: input.material,
      flow_class: input.flowClass ?? null,
    }
    const { data, error } = await supabase.from('filters').insert(row).select('*').single()
    if (!error) return data

    // Unique violation: the same filter is already in the catalogue under another spelling.
    if (error.code === '23505') {
      const query = supabase.from('filters').select('*').eq('match_key', filterMatchKey(row.brand, row.model))
      const { data: match, error: matchError } = await (row.size === null
        ? query.is('size', null)
        : query.eq('size', row.size)
      ).maybeSingle()
      fail(matchError)
      if (match) return match
    }
    throw new Error(error.message)
  },

  async setDefaultFilter(filterId) {
    const { error } = await supabase.rpc('set_default_filter', { target: filterId })
    fail(error)
  },

  async removeMyFilter(filterId) {
    const { error } = await supabase.rpc('remove_my_filter', { target: filterId })
    fail(error)
  },

  async listMyBags(): Promise<Bag[]> {
    const { data, error } = await supabase
      .from('user_beans')
      .select('id, roast_date, grams_remaining, status, created_at, beans(*)')
      .order('created_at', { ascending: false })
    fail(error)
    return (
      data as unknown as {
        id: string
        roast_date: string | null
        grams_remaining: number | null
        status: string
        created_at: string
        beans: BeanRow
      }[]
    ).map((row) => ({
      id: row.id,
      bean: toBean(row.beans),
      roastDate: row.roast_date,
      gramsRemaining: row.grams_remaining,
      status: row.status as BagStatus,
      createdAt: row.created_at,
    }))
  },

  async searchBeans(query): Promise<BeanMatch[]> {
    const { data, error } = await supabase.rpc('search_beans', { q: query })
    fail(error)
    return data.map((row) => ({
      id: row.id,
      roaster: row.roaster,
      name: row.name,
      origin: row.origin,
      region: row.region,
      producer: row.producer,
      variety: row.variety,
      process: row.process,
      altitudeM: row.altitude_m,
      roastLevel: row.roast_level as RoastLevel | null,
      roasterNotes: row.roaster_notes,
      owned: row.owned,
      friendsWithRecipe: row.friends_with_recipe,
    }))
  },

  async addBag(input) {
    const { newBean } = input
    const { error } = await supabase.rpc('add_bag', {
      p_bag_id: input.bagId,
      p_bean_id: input.beanId,
      p_new_bean_id: input.newBeanId,
      p_new_bean: newBean
        ? {
            roaster: newBean.roaster,
            name: newBean.name,
            origin: newBean.origin ?? null,
            region: newBean.region ?? null,
            producer: newBean.producer ?? null,
            variety: newBean.variety ?? null,
            process: newBean.process ?? null,
            altitude_m: newBean.altitudeM ?? null,
            roast_level: newBean.roastLevel ?? null,
            roaster_notes: newBean.roasterNotes,
          }
        : undefined,
      p_roast_date: input.roastDate ?? undefined,
      p_grams: input.grams ?? undefined,
    })
    fail(error)
  },

  async removeBag(bagId) {
    const { error } = await supabase.from('user_beans').delete().eq('id', bagId)
    fail(error)
  },
}
