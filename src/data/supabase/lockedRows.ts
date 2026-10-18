import { supabase } from '../../lib/supabase'
import type { LockedRecipeBase, Method, RecipeSnapshot } from '../types'
import { currentUserId, fail, toBean } from './shared'

/** A locked recipe as stored, with its locked version and its bean. */
export interface LockedRow extends LockedRecipeBase {
  ownerId: string
  versionId: string
}

/**
 * Locked recipes with their versions and beans, either yours or your friends'. Row-level security lets
 * you read both, so the owner has to be said out loud: leaving it out lists friends' recipes as yours.
 */
export async function loadLockedRows(scope: 'mine' | 'friends'): Promise<LockedRow[]> {
  const me = await currentUserId()
  const base = supabase.from('recipes').select('id, owner_id, bean_id, method, name, locked_version_id')
  const { data: recipes, error } = await (scope === 'mine' ? base.eq('owner_id', me) : base.neq('owner_id', me))
    .not('locked_version_id', 'is', null)
    .is('archived_at', null)
  fail(error)
  if (recipes.length === 0) return []
  const [versions, beans] = await Promise.all([
    supabase.from('recipe_versions').select('id, params, created_at').in('id', recipes.map((r) => r.locked_version_id!)),
    supabase.from('beans').select('*').in('id', [...new Set(recipes.map((r) => r.bean_id))]),
  ])
  fail(versions.error)
  fail(beans.error)
  return recipes.flatMap((recipe) => {
    const version = versions.data.find((v) => v.id === recipe.locked_version_id)
    const bean = beans.data.find((b) => b.id === recipe.bean_id)
    if (!version || !bean) return []
    return [
      {
        id: recipe.id,
        ownerId: recipe.owner_id,
        versionId: version.id,
        bean: toBean(bean),
        method: recipe.method as Method,
        name: recipe.name,
        lockedAt: version.created_at,
        snapshot: version.params as unknown as RecipeSnapshot,
      },
    ]
  })
}
