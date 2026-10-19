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
  // As in a database where the suggest-tweak migration hasn't run yet: no `suggestion` column.
  recipe_drafts: [
    {
      user_id: 'me', bean_id: 'bean-1', method: 'v60', choices: { cups: 2 }, updated_at: '2026-10-19T08:00:00Z',
      last_brew: { brewedAt: '2026-10-19T08:00:00Z', notes: 'Need to go finer next time.' },
    },
  ],
}

const deleted: { table: string; filters: Record<string, unknown> }[] = []

function query(table: string) {
  let rows = [...(tables[table] ?? [])]
  let missing: string | null = null
  const builder = {
    // Like the real database: asking for a column the table doesn't have is an error.
    select: (columns = '*') => {
      const known = rows[0] ? Object.keys(rows[0]) : null
      const plain = columns.split(',').map((c) => c.trim()).filter((c) => c && c !== '*' && /^[a-z_]+$/.test(c))
      missing = known ? (plain.find((c) => !known.includes(c)) ?? null) : null
      return builder
    },
    eq: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] === value)), builder),
    neq: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] !== value)), builder),
    is: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] === value)), builder),
    not: (column: string, _op: string, value: unknown) => ((rows = rows.filter((r) => r[column] !== value)), builder),
    in: (column: string, values: unknown[]) => ((rows = rows.filter((r) => values.includes(r[column]))), builder),
    delete: () => {
      const filters: Record<string, unknown> = {}
      const del = {
        eq: (column: string, value: unknown) => ((filters[column] = value), del),
        then: (resolve: (value: { data: null; error: null }) => unknown) => (deleted.push({ table, filters }), resolve({ data: null, error: null })),
      }
      return del
    },
    then: (resolve: (value: { data: Row[] | null; error: { message: string } | null }) => unknown) =>
      resolve(missing ? { data: null, error: { message: `column ${table}.${missing} does not exist` } } : { data: rows, error: null }),
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

describe('removeFriend', () => {
  it('deletes the one friendship row, which stores the smaller id first', async () => {
    await supabaseApi.removeFriend('zed')
    await supabaseApi.removeFriend('abc')
    expect(deleted).toEqual([
      { table: 'friendships', filters: { user_a: 'me', user_b: 'zed' } },
      { table: 'friendships', filters: { user_a: 'abc', user_b: 'me' } },
    ])
  })
})

describe('listMyDrafts', () => {
  it('loads drafts from a database without the suggestion column, with no suggestion', async () => {
    const drafts = await supabaseApi.listMyDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ beanId: 'bean-1', method: 'v60', suggestion: null })
    expect(drafts[0]?.lastBrew?.notes).toBe('Need to go finer next time.')
  })
})

