import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import type { CalibrationSource } from '../../engine/grinder.ts'
import type { BrewChoices } from '../brew/params'
import type { Json } from '../lib/database.types'
import {
  BROWSE_LIMIT,
  byBrandModel,
  filterMatchKey,
  type Api,
  type Bag,
  type BagStatus,
  type Bean,
  type BrewResult,
  type Draft,
  type Friend,
  type FriendRecipe,
  type InviterPreview,
  type PendingInvite,
  type LockedRecipe,
  type Method,
  type RecipeSnapshot,
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
/** The bean columns every catalogue query returns. */
type BeanFields = Omit<BeanRow, 'match_key' | 'created_at' | 'created_by'>

function toBean(row: BeanFields): Bean {
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

/** A catalogue row from search_beans or browse_beans: the bean plus what is personal about it. */
type BeanMatchRow = BeanFields & {
  owned: boolean
  friends_with_recipe: number
}

function toBeanMatch(row: BeanMatchRow): BeanMatch {
  return { ...toBean(row), owned: row.owned, friendsWithRecipe: row.friends_with_recipe }
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

  async listRoasters() {
    const { data, error } = await supabase.from('beans').select('roaster')
    fail(error)
    return data.map((row) => row.roaster)
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

  async browseBeans(): Promise<BeanMatch[]> {
    const { data, error } = await supabase.rpc('browse_beans', { max_results: BROWSE_LIMIT })
    fail(error)
    return data.map(toBeanMatch)
  },

  async searchBeans(query): Promise<BeanMatch[]> {
    const { data, error } = await supabase.rpc('search_beans', { q: query })
    fail(error)
    return data.map(toBeanMatch)
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

  async updateBag(bagId, patch) {
    const row = {
      ...(patch.gramsRemaining !== undefined ? { grams_remaining: patch.gramsRemaining } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }
    const { error } = await supabase.from('user_beans').update(row).eq('id', bagId)
    fail(error)
  },

  async removeBag(bagId) {
    const { error } = await supabase.from('user_beans').delete().eq('id', bagId)
    fail(error)
  },
  async listMyDrafts(): Promise<Draft[]> {
    const { data, error } = await supabase.from('recipe_drafts').select('bean_id, method, choices, last_brew, updated_at')
    fail(error)
    return data.map((row) => ({
      beanId: row.bean_id,
      method: row.method as Method,
      choices: row.choices as unknown as BrewChoices,
      lastBrew: row.last_brew as unknown as BrewResult | null,
      updatedAt: row.updated_at,
    }))
  },

  async saveDraft(input) {
    const row = {
      bean_id: input.beanId,
      method: input.method,
      choices: input.choices as unknown as Json,
      updated_at: new Date().toISOString(),
      ...(input.lastBrew ? { last_brew: input.lastBrew as unknown as Json } : {}),
    }
    const { error } = await supabase.from('recipe_drafts').upsert(row, { onConflict: 'user_id,bean_id,method' })
    fail(error)
  },

  async listMyRecipes(): Promise<LockedRecipe[]> {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, bean_id, method, name, locked_version_id')
      .not('locked_version_id', 'is', null)
      .is('archived_at', null)
    fail(error)
    const versionIds = recipes.map((r) => r.locked_version_id!).filter(Boolean)
    if (versionIds.length === 0) return []
    const recipeIds = recipes.map((r) => r.id)
    const [versions, allVersions, brews] = await Promise.all([
      supabase.from('recipe_versions').select('id, params, created_at').in('id', versionIds),
      supabase.from('recipe_versions').select('id, recipe_id').in('recipe_id', recipeIds),
      supabase.from('brews').select('recipe_version_id, feedback'),
    ])
    fail(versions.error)
    fail(allVersions.error)
    fail(brews.error)
    return recipes.flatMap((recipe) => {
      const version = versions.data.find((v) => v.id === recipe.locked_version_id)
      if (!version) return []
      const feedback = brews.data.find((b) => b.recipe_version_id === version.id)?.feedback as { rating?: number } | null
      const mine = new Set(allVersions.data.filter((v) => v.recipe_id === recipe.id).map((v) => v.id))
      return [
        {
          id: recipe.id,
          beanId: recipe.bean_id,
          method: recipe.method as Method,
          name: recipe.name,
          versionId: version.id,
          snapshot: version.params as unknown as RecipeSnapshot,
          rating: feedback?.rating ?? null,
          lockedAt: version.created_at,
          brewCount: brews.data.filter((b) => mine.has(b.recipe_version_id)).length,
        },
      ]
    })
  },

  async archiveRecipe(recipeId) {
    const { error } = await supabase.from('recipes').update({ archived_at: new Date().toISOString() }).eq('id', recipeId)
    fail(error)
  },

  async lockRecipe(input) {
    const { error } = await supabase.rpc('lock_recipe', {
      p_recipe_id: input.recipeId,
      p_version_id: input.versionId,
      p_brew_id: input.brewId,
      p_user_bean_id: input.bagId,
      p_method: input.method,
      p_name: input.name,
      p_params: input.snapshot as unknown as Json,
      p_grind_um: input.snapshot.recipe.grindUm,
      p_brew_params: input.snapshot as unknown as Json,
      p_actual_time_s: input.result.totalTimeS,
      p_yield_ml: input.result.yieldG,
      p_feedback: { rating: input.rating, tastes: input.result.tastes, improve: input.result.improve, compared: input.result.compared, notes: input.result.notes } as Json,
      p_brewed_at: input.result.brewedAt,
    })
    fail(error)
  },
  async listFriends(): Promise<Friend[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    fail(userError)
    const me = userData.user.id
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
    const { data: userData, error: userError } = await supabase.auth.getUser()
    fail(userError)
    // Row-level security already limits this to friends' recipes that are currently locked.
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, owner_id, bean_id, method, name, locked_version_id')
      .neq('owner_id', userData.user.id)
      .not('locked_version_id', 'is', null)
      .is('archived_at', null)
    fail(error)
    if (recipes.length === 0) return []
    const [versions, profiles, beans] = await Promise.all([
      supabase.from('recipe_versions').select('id, params, created_at').in('id', recipes.map((r) => r.locked_version_id!)),
      supabase.from('profiles').select('id, display_name, avatar_url').in('id', [...new Set(recipes.map((r) => r.owner_id))]),
      supabase.from('beans').select('*').in('id', [...new Set(recipes.map((r) => r.bean_id))]),
    ])
    fail(versions.error)
    fail(profiles.error)
    fail(beans.error)
    return recipes
      .flatMap((recipe) => {
        const version = versions.data.find((v) => v.id === recipe.locked_version_id)
        const bean = beans.data.find((b) => b.id === recipe.bean_id)
        if (!version || !bean) return []
        const owner = profiles.data.find((p) => p.id === recipe.owner_id)
        return [
          {
            id: recipe.id,
            friend: { id: recipe.owner_id, name: owner?.display_name ?? 'A friend', avatarUrl: owner?.avatar_url ?? null },
            bean: toBean(bean),
            method: recipe.method as Method,
            name: recipe.name,
            lockedAt: version.created_at,
            snapshot: version.params as unknown as RecipeSnapshot,
          },
        ]
      })
      .sort((a, b) => b.lockedAt.localeCompare(a.lockedAt))
  },
}
