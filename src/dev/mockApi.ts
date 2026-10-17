import { GRINDER_SEED } from '../../engine/grinderSeed.ts'
import { byBrandModel, filterMatchKey, type Api, type FilterRow, type MyFilter, type MyGrinder, type Profile } from '../data/types'

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
  const myFilters = new Map<string, { nickname: string | null; isDefault: boolean }>()
  const filters = [...SEED_FILTERS]

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
  }
}
