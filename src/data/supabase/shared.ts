import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import type { Bean, BeanMatch, RoastLevel } from '../types'

/** Throws the database's message, so callers can treat the data as present afterwards. */
export function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}


/** Who is signed in. Anything that depends on "me" asks here, not on its own. */
export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  fail(error)
  return data.user.id
}

export type BeanRow = Database['public']['Tables']['beans']['Row']
/** The bean columns every catalogue query returns. */
export type BeanFields = Omit<BeanRow, 'match_key' | 'created_at' | 'created_by'>

export function toBean(row: BeanFields): Bean {
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
export type BeanMatchRow = BeanFields & {
  owned: boolean
  friends_with_recipe: number
}

export function toBeanMatch(row: BeanMatchRow): BeanMatch {
  return { ...toBean(row), owned: row.owned, friendsWithRecipe: row.friends_with_recipe }
}
