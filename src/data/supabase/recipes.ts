import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import type { BrewChoices } from '../../brew/params'
import type { RecipesApi } from '../api'
import type { StoredSuggestion } from '../../../supabase/functions/suggest-tweak/suggest.ts'
import { SuggestError, type BrewResult, type Draft, type LockedRecipe, type Method } from '../types'
import { loadLockedRows } from './lockedRows'
import { fail } from './shared'

export const recipesApi: RecipesApi = {
  async listMyDrafts(): Promise<Draft[]> {
    // Every column, not a list: a database without the newer `suggestion` column still loads drafts
    // (it's just absent), so the app doesn't depend on the migration landing first.
    const { data, error } = await supabase.from('recipe_drafts').select('*')
    fail(error)
    return data.map((row) => ({
      beanId: row.bean_id,
      method: row.method as Method,
      choices: row.choices as unknown as BrewChoices,
      lastBrew: row.last_brew as unknown as BrewResult | null,
      suggestion: (row.suggestion ?? null) as unknown as StoredSuggestion | null,
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

  async suggestTweak(beanId, brewedAt) {
    const { data, error } = await supabase.functions.invoke<{ suggestion: StoredSuggestion; cached: boolean }>('suggest-tweak', {
      body: { beanId, method: 'v60', brewedAt },
    })
    if (error) {
      // No response at all: the connection dropped.
      if (!(error instanceof FunctionsHttpError)) throw new SuggestError('offline')
      const code = await (error.context as Response).json().then((body: { error?: string }) => body?.error, () => undefined)
      if (code === 'daily_limit') throw new SuggestError('limit')
      if (code === 'stale' || code === 'not_eligible' || code === 'not_enabled') throw new SuggestError(code)
      throw new SuggestError('failed')
    }
    if (!data?.suggestion) throw new SuggestError('failed')
    return data
  },

  async setSuggestionApplied(beanId, method, appliedAt) {
    const { data, error } = await supabase.from('recipe_drafts').select('suggestion').eq('bean_id', beanId).eq('method', method).maybeSingle()
    fail(error)
    if (!data?.suggestion) return
    const suggestion = { ...(data.suggestion as Record<string, Json>), appliedAt }
    const { error: updateError } = await supabase.from('recipe_drafts').update({ suggestion }).eq('bean_id', beanId).eq('method', method)
    fail(updateError)
  },

  async listMyRecipes(): Promise<LockedRecipe[]> {
    const rows = await loadLockedRows('mine')
    if (rows.length === 0) return []
    const [allVersions, brews] = await Promise.all([
      supabase.from('recipe_versions').select('id, recipe_id').in('recipe_id', rows.map((r) => r.id)),
      supabase.from('brews').select('recipe_version_id, feedback'),
    ])
    fail(allVersions.error)
    fail(brews.error)
    return rows.map(({ ownerId: _owner, ...recipe }) => {
      const feedback = brews.data.find((b) => b.recipe_version_id === recipe.versionId)?.feedback as { rating?: number } | null
      const versions = new Set(allVersions.data.filter((v) => v.recipe_id === recipe.id).map((v) => v.id))
      return { ...recipe, rating: feedback?.rating ?? null, brewCount: brews.data.filter((b) => versions.has(b.recipe_version_id)).length }
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
}
