import type { GrinderModel } from '../../engine/grinder.ts'
import type { TempUnit } from '../../engine/units.ts'
import type { Database } from '../lib/database.types'

export type Method = 'v60' | 'aeropress' | 'espresso'
export const METHODS: Method[] = ['v60', 'aeropress', 'espresso']
export const METHOD_LABELS: Record<Method, string> = {
  v60: 'V60',
  aeropress: 'AeroPress',
  espresso: 'Espresso',
}
export const METHOD_OPTIONS = METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))

type Tables = Database['public']['Tables']

export type Profile = Omit<Tables['profiles']['Row'], 'temp_unit' | 'default_method'> & {
  temp_unit: TempUnit
  default_method: Method
}

export type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'temp_unit' | 'default_method'>>

/** A grinder from the shared catalogue, ready for the converter. */
export type CatalogueGrinder = GrinderModel

export interface MyGrinder {
  grinder: CatalogueGrinder
  nickname: string | null
  offsetUm: number
}

export type FilterRow = Tables['filters']['Row']

/** Same normalisation as the generated `filters.match_key` column, so 'T-90' and 'T90' collide. */
export const filterMatchKey = (brand: string, model: string) =>
  (brand + model).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

/** Stable display order for gear lists: brand, then model, then size. */
export function byBrandModel(
  a: { brand: string; model: string; size?: string | null },
  b: { brand: string; model: string; size?: string | null },
): number {
  return (
    a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || (a.size ?? '').localeCompare(b.size ?? '')
  )
}

export interface MyFilter {
  filter: FilterRow
  nickname: string | null
  isDefault: boolean
}

export interface NewFilter {
  brand: string
  model: string
  size?: string
  material: 'paper' | 'metal' | 'cloth'
  flowClass?: 'fast' | 'medium' | 'slow'
}

/** Everything the profile screen needs from the backend. Real and fake versions share it. */
export interface Api {
  getProfile(userId: string): Promise<Profile>
  updateProfile(userId: string, patch: ProfilePatch): Promise<Profile>

  listGrinderCatalogue(): Promise<CatalogueGrinder[]>
  listMyGrinders(): Promise<MyGrinder[]>
  addMyGrinder(grinderId: string): Promise<void>
  removeMyGrinder(grinderId: string): Promise<void>

  listFilterCatalogue(): Promise<FilterRow[]>
  listMyFilters(): Promise<MyFilter[]>
  /**
   * Adds a catalogue filter to the user's list; it becomes the default when the list has none.
   * Adding one that is already in the list does nothing.
   */
  addMyFilter(filterId: string): Promise<void>
  /** Adds a new filter to the shared catalogue, or returns the existing match. */
  createFilter(input: NewFilter): Promise<FilterRow>
  setDefaultFilter(filterId: string): Promise<void>
  /** Removes a filter from the user's list. Removing the default promotes another one. */
  removeMyFilter(filterId: string): Promise<void>
}
