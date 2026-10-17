import { GRINDER_SEED } from '../../engine/grinderSeed.ts'
import {
  byBrandModel,
  filterMatchKey,
  type Api,
  type Bag,
  type Bean,
  type Draft,
  type LockedRecipe,
  type FilterRow,
  type MyFilter,
  type MyGrinder,
  type Profile,
} from '../data/types'

const bean = (b: Partial<Bean> & Pick<Bean, 'id' | 'roaster' | 'name'>): Bean => ({
  origin: null,
  region: null,
  producer: null,
  variety: null,
  process: null,
  altitudeM: null,
  roastLevel: null,
  roasterNotes: [],
  ...b,
})

/** Shared catalogue the mock starts with. */
export const SEED_BEANS: Bean[] = [
  bean({ id: 'b-elto', roaster: 'Coffea Circulor', name: 'Elto Arbegona', origin: 'Ethiopia', region: 'Sidama', process: 'Washed', roastLevel: 'light', roasterNotes: ['bergamot', 'tangerine'] }),
  bean({ id: 'b-pink', roaster: "Father's", name: 'Pink Bourbon', origin: 'Colombia', variety: 'Pink Bourbon', process: 'Washed', roastLevel: 'light', roasterNotes: ['citrus', 'floral', 'hibiscus'] }),
  bean({ id: 'b-geisha', roaster: 'Placeholder Roasters', name: 'Tanzania Geisha', origin: 'Tanzania', region: 'Arusha', variety: 'Geisha', process: 'Washed', roastLevel: 'light', roasterNotes: ['black tea', 'candied lemon', 'vanilla'] }),
  bean({ id: 'b-guji', roaster: 'Coffea Circulor', name: 'Guji Natural', origin: 'Ethiopia', region: 'Guji', process: 'Natural', roastLevel: 'light' }),
]

const beanKey = (roaster: string, name: string) => (roaster + name).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

const SEED_FILTERS: FilterRow[] = [
  { id: 'f-cafec-t90', brand: 'CAFEC', model: 'T-90', size: '02', material: 'paper', flow_class: 'fast', bleached: null, created_by: null, match_key: 'cafect90' },
  { id: 'f-cafec-abaca', brand: 'CAFEC', model: 'Abaca', size: '02', material: 'paper', flow_class: 'medium', bleached: null, created_by: null, match_key: 'cafecabaca' },
  { id: 'f-hario-v60', brand: 'Hario', model: 'V60 paper', size: '02', material: 'paper', flow_class: 'medium', bleached: true, created_by: null, match_key: 'hariov60paper' },
]

export interface MockOptions {
  /** Simulated network delay in ms. */
  latencyMs?: number
  profile?: Partial<Profile>
  grinderIds?: string[]
  /** Catalogue filter ids already in the user's list; the first becomes the default. */
  filterIds?: string[]
  bags?: Bag[]
  /** Ids of catalogue beans that friends have a locked recipe for, with how many. */
  friendRecipes?: Record<string, number>
  /** Make addBag fail, to test rollback. */
  failAddBag?: boolean
  /** While this returns true, saving a draft or locking a recipe fails like a dropped connection. */
  isOffline?: () => boolean
  drafts?: Draft[]
  recipes?: LockedRecipe[]
}

/** In-memory Api for tests and the dev preview. Mirrors the rules the database enforces. */
export function createMockApi(options: MockOptions = {}): Api {
  const { latencyMs = 0 } = options
  let profile: Profile = {
    id: 'user-1',
    display_name: 'Robin',
    avatar_url: null,
    created_at: '2026-10-17T12:00:00Z',
    temp_unit: 'c',
    default_method: 'v60',
    ...options.profile,
  }
  const grinderIds = new Set(options.grinderIds ?? [])
  const myFilters = new Map<string, { nickname: string | null; isDefault: boolean }>(
    (options.filterIds ?? []).map((id, i) => [id, { nickname: null, isDefault: i === 0 }]),
  )
  const filters = [...SEED_FILTERS]
  const catalogue = [...SEED_BEANS]
  const bags = (options.bags ?? []).map((bag) => structuredClone(bag))
  for (const bag of bags) if (!catalogue.some((b) => b.id === bag.bean.id)) catalogue.push(bag.bean)
  const friendRecipes = options.friendRecipes ?? { 'b-elto': 1 }
  const drafts = new Map<string, Draft>((options.drafts ?? []).map((d) => [`${d.beanId}:${d.method}`, d]))
  const recipes = [...(options.recipes ?? [])]
  const lockedBrews = new Set<string>()
  const needNetwork = () => {
    if (options.isOffline?.()) throw new TypeError('Failed to fetch')
  }

  const wait = <T,>(value: T): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), latencyMs))

  return {
    getProfile: () => wait(profile),

    async updateProfile(_userId, patch) {
      if (patch.display_name !== undefined && !patch.display_name.trim()) throw new Error('Name cannot be empty')
      profile = { ...profile, ...patch }
      return wait(profile)
    },

    listGrinderCatalogue: () => wait(GRINDER_SEED),

    listMyGrinders: () =>
      wait<MyGrinder[]>(
        GRINDER_SEED.filter((g) => grinderIds.has(g.id))
          .sort(byBrandModel)
          .map((grinder) => ({ grinder, nickname: null, offsetUm: 0 })),
      ),

    async addMyGrinder(grinderId) {
      grinderIds.add(grinderId)
      return wait(undefined)
    },

    async removeMyGrinder(grinderId) {
      grinderIds.delete(grinderId)
      return wait(undefined)
    },

    listFilterCatalogue: () => wait(filters),

    listMyFilters: () =>
      wait<MyFilter[]>(
        filters
          .filter((f) => myFilters.has(f.id))
          .sort(byBrandModel)
          .map((filter) => ({ filter, ...myFilters.get(filter.id)! })),
      ),

    async addMyFilter(filterId) {
      if (!myFilters.has(filterId)) {
        const hasDefault = [...myFilters.values()].some((entry) => entry.isDefault)
        myFilters.set(filterId, { nickname: null, isDefault: !hasDefault })
      }
      return wait(undefined)
    },

    async createFilter(input) {
      const match = filters.find(
        (f) =>
          f.match_key === filterMatchKey(input.brand, input.model) && (f.size ?? null) === (input.size?.trim() || null),
      )
      if (match) return wait(match)
      const row: FilterRow = {
        id: `f-${filters.length + 1}`,
        brand: input.brand.trim(),
        model: input.model.trim(),
        size: input.size?.trim() || null,
        material: input.material,
        flow_class: input.flowClass ?? null,
        bleached: null,
        created_by: profile.id,
        match_key: filterMatchKey(input.brand, input.model),
      }
      filters.push(row)
      return wait(row)
    },

    async setDefaultFilter(filterId) {
      if (!myFilters.has(filterId)) throw new Error('filter_not_in_list')
      for (const [id, entry] of myFilters) myFilters.set(id, { ...entry, isDefault: id === filterId })
      return wait(undefined)
    },

    async removeMyFilter(filterId) {
      myFilters.delete(filterId)
      const rest = filters.filter((f) => myFilters.has(f.id)).sort(byBrandModel)
      if (rest.length && !rest.some((f) => myFilters.get(f.id)!.isDefault)) {
        myFilters.set(rest[0]!.id, { ...myFilters.get(rest[0]!.id)!, isDefault: true })
      }
      return wait(undefined)
    },

    listRoasters: () => wait(catalogue.map((b) => b.roaster)),

    listMyBags: () => wait([...bags].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

    async searchBeans(query) {
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean)
      if (tokens.length === 0) return wait([])
      const owned = new Set(bags.map((b) => b.bean.id))
      return wait(
        catalogue
          .filter((b) => tokens.every((t) => beanKey(b.roaster, b.name).includes(t)))
          .map((b) => ({ ...b, owned: owned.has(b.id), friendsWithRecipe: friendRecipes[b.id] ?? 0 })),
      )
    },

    async addBag(input) {
      await wait(undefined)
      if (options.failAddBag) throw new Error('Could not save')
      if (bags.some((b) => b.id === input.bagId)) return
      let target = input.beanId ? catalogue.find((b) => b.id === input.beanId) : undefined
      if (!target && input.newBean) {
        const nb = input.newBean
        if (!nb.roaster.trim() || !nb.name.trim()) throw new Error('invalid_bean_name')
        target = catalogue.find((b) => beanKey(b.roaster, b.name) === beanKey(nb.roaster, nb.name))
        if (!target) {
          target = bean({
            id: input.newBeanId ?? `b-${catalogue.length + 1}`,
            roaster: nb.roaster.trim(),
            name: nb.name.trim(),
            origin: nb.origin ?? null,
            region: nb.region ?? null,
            producer: nb.producer ?? null,
            variety: nb.variety ?? null,
            process: nb.process ?? null,
            altitudeM: nb.altitudeM ?? null,
            roastLevel: nb.roastLevel ?? null,
            roasterNotes: nb.roasterNotes,
          })
          catalogue.push(target)
        }
      }
      if (!target) throw new Error('bean_required')
      bags.push({
        id: input.bagId,
        bean: target,
        roastDate: input.roastDate ?? null,
        gramsRemaining: input.grams ?? null,
        status: 'new',
        createdAt: new Date().toISOString(),
      })
    },

    async updateBag(bagId, patch) {
      needNetwork()
      const bag = bags.find((b) => b.id === bagId)
      if (!bag) throw new Error('bag_not_found')
      if (patch.gramsRemaining !== undefined) bag.gramsRemaining = patch.gramsRemaining
      if (patch.status !== undefined) bag.status = patch.status
      return wait(undefined)
    },

    async removeBag(bagId) {
      const at = bags.findIndex((b) => b.id === bagId)
      if (at >= 0) bags.splice(at, 1)
      return wait(undefined)
    },

    listMyDrafts: () => wait([...drafts.values()]),

    async saveDraft(input) {
      needNetwork()
      const key = `${input.beanId}:${input.method}`
      const existing = drafts.get(key)
      drafts.set(key, {
        beanId: input.beanId,
        method: input.method,
        choices: input.choices,
        lastBrew: input.lastBrew ?? existing?.lastBrew ?? null,
        updatedAt: new Date().toISOString(),
      })
      return wait(undefined)
    },

    listMyRecipes: () => wait(recipes),

    async archiveRecipe(recipeId) {
      needNetwork()
      const at = recipes.findIndex((r) => r.id === recipeId)
      if (at >= 0) recipes.splice(at, 1)
      return wait(undefined)
    },

    async lockRecipe(input) {
      needNetwork()
      if (lockedBrews.has(input.brewId)) return wait(undefined)
      const bag = bags.find((b) => b.id === input.bagId)
      if (!bag) throw new Error('bag_not_found')
      lockedBrews.add(input.brewId)
      const next: LockedRecipe = {
        id: input.recipeId,
        beanId: bag.bean.id,
        method: input.method,
        name: input.name,
        versionId: input.versionId,
        snapshot: input.snapshot,
        rating: input.rating,
        lockedAt: input.result.brewedAt,
        brewCount: 1,
      }
      const at = recipes.findIndex((r) => r.beanId === next.beanId && r.method === next.method)
      if (at >= 0) recipes[at] = { ...next, id: recipes[at]!.id, name: recipes[at]!.name, brewCount: recipes[at]!.brewCount + 1 }
      else recipes.push(next)
      return wait(undefined)
    },
  }
}
