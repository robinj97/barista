import { describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

/** A tiny stand-in for the database that, like the real one for a signed-in user, also returns friends' locked recipes. */
const tables: Record<string, Row[]> = {
  recipes: [
    { id: 'mine', owner_id: 'me', bean_id: 'bean-1', method: 'v60', name: 'V60', locked_version_id: 'v1', archived_at: null },
    { id: 'friends', owner_id: 'friend', bean_id: 'bean-2', method: 'v60', name: 'V60', locked_version_id: 'v2', archived_at: null },
  ],
  recipe_versions: [
    { id: 'v1', recipe_id: 'mine', params: { choices: {}, recipe: {} }, created_at: '2026-10-10T10:00:00Z' },
    { id: 'v2', recipe_id: 'friends', params: { choices: {}, recipe: {} }, created_at: '2026-10-11T10:00:00Z' },
  ],
  brews: [{ recipe_version_id: 'v1', feedback: { rating: 4 } }],
  beans: [
    { id: 'bean-1', roaster: 'Parallel', name: 'Finca Milan', origin: null, region: null, producer: null, variety: null, process: null, altitude_m: null, roast_level: null, roaster_notes: [] },
    { id: 'bean-2', roaster: 'Taith', name: 'Lychee peach', origin: null, region: null, producer: null, variety: null, process: null, altitude_m: null, roast_level: null, roaster_notes: [] },
  ],
  profiles: [{ id: 'friend', display_name: 'Mario', avatar_url: null }],
}

function query(table: string) {
  let rows = [...(tables[table] ?? [])]
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] === value)), builder),
    neq: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] !== value)), builder),
    is: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] === value)), builder),
    not: (column: string, _op: string, value: unknown) => ((rows = rows.filter((r) => r[column] !== value)), builder),
    in: (column: string, values: unknown[]) => ((rows = rows.filter((r) => values.includes(r[column]))), builder),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
  }
  return builder
}

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) }, from: (table: string) => query(table) },
}))

const { supabaseApi } = await import('./supabaseApi')

describe('listMyRecipes', () => {
  it("returns only your own recipes, never a friend's that row-level security lets you read", async () => {
    const recipes = await supabaseApi.listMyRecipes()
    expect(recipes.map((r) => r.id)).toEqual(['mine'])
    expect(recipes[0]?.rating).toBe(4)
  })

  it('carries each recipe\'s own bean, so the list never needs your bag', async () => {
    const [recipe] = await supabaseApi.listMyRecipes()
    expect(recipe?.bean).toMatchObject({ id: 'bean-1', roaster: 'Parallel', name: 'Finca Milan' })
  })
})

describe('listFriendRecipes', () => {
  it("returns only friends' recipes, with the friend and the bean", async () => {
    const recipes = await supabaseApi.listFriendRecipes()
    expect(recipes.map((r) => r.id)).toEqual(['friends'])
    expect(recipes[0]?.friend.name).toBe('Mario')
    expect(recipes[0]?.bean.name).toBe('Lychee peach')
  })
})
