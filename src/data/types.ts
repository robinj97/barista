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
  /** Adds a catalogue filter to the user's list. The first one becomes the default. */
  addMyFilter(filterId: string): Promise<void>
  /** Adds a new filter to the shared catalogue, or returns the existing match. */
  createFilter(input: NewFilter): Promise<FilterRow>
  setDefaultFilter(filterId: string): Promise<void>
  removeMyFilter(filterId: string): Promise<void>
}
