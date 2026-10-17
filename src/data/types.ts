import type { GrinderModel } from '../../engine/grinder.ts'
import type { TempUnit } from '../../engine/units.ts'
import type { Pour } from '../../engine/types.ts'
import type { BrewChoices } from '../brew/params'
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

  /** Roasters that already exist in the shared catalogue, for matching and type-ahead. */
  listRoasters(): Promise<string[]>
  listMyBags(): Promise<Bag[]>
  /** Catalogue search: every word matches roaster + name in any order, tolerant of small typos. */
  searchBeans(query: string): Promise<BeanMatch[]>
  /**
   * Adds a bag, creating the shared bean first when needed. Idempotent for the same `bagId`.
   * An exact roaster + name match reuses the existing catalogue bean.
   */
  addBag(input: AddBagInput): Promise<void>
  removeBag(bagId: string): Promise<void>
  /** Changes what is yours about a bag: how much is left, or where you are with it. */
  updateBag(bagId: string, patch: BagPatch): Promise<void>

  /** Your working recipes: one per bean and method, overwritten as you brew. */
  listMyDrafts(): Promise<Draft[]>
  /** Creates or overwrites the working recipe. Leaving `lastBrew` out keeps the stored one. */
  saveDraft(input: SaveDraftInput): Promise<void>
  /** The recipes you have locked in, with their current locked version. */
  listMyRecipes(): Promise<LockedRecipe[]>
  /** Locks a brew in as your recipe. Idempotent for the same `brewId`. */
  lockRecipe(input: LockRecipeInput): Promise<void>
}

export type Taste = 'good' | 'sour' | 'bitter' | 'weak' | 'heavy'
export const TASTE_LABELS: Record<Taste, string> = { good: 'Good', sour: 'Sour', bitter: 'Bitter', weak: 'Weak', heavy: 'Heavy' }
export type Compared = 'sweeter' | 'more_acidity' | 'same'

/** What happened in a brew, as logged. */
export interface BrewResult {
  brewedAt: string
  /** Seconds from the start of the timer to the end of the drawdown. Null when the timer was not used. */
  totalTimeS: number | null
  taste: Taste | null
  /** Against the previous brew of this bean. Null when there was none or it was skipped. */
  compared: Compared | null
  yieldG: number | null
  notes: string
  /** Water in the first pour, so "sweeter or more acidity" can be checked against what changed. */
  firstPourG: number
}

/** The numbers a recipe resolved to, kept next to the choices that produced them. */
export interface RecipeNumbers {
  doseG: number
  waterG: number
  ratio: number
  tempC: number
  grindUm: number
  targetTimeS: number
  pours: Pour[]
}

export interface RecipeSnapshot {
  choices: BrewChoices
  recipe: RecipeNumbers
}

export interface Draft {
  beanId: string
  method: Method
  choices: BrewChoices
  lastBrew: BrewResult | null
  updatedAt: string
}

export interface SaveDraftInput {
  beanId: string
  method: Method
  choices: BrewChoices
  lastBrew?: BrewResult
}

export interface LockedRecipe {
  id: string
  beanId: string
  method: Method
  name: string
  versionId: string
  snapshot: RecipeSnapshot
  rating: number | null
  lockedAt: string
}

export interface LockRecipeInput {
  /** All minted on the device, so a retry after a dropped connection cannot double-save. */
  recipeId: string
  versionId: string
  brewId: string
  bagId: string
  method: Method
  name: string
  snapshot: RecipeSnapshot
  result: BrewResult
  rating: number
}

export type RoastLevel = 'light' | 'medium' | 'dark'
export type BagStatus = 'new' | 'dialing_in' | 'locked'

/** What is true of the coffee itself. Shared with every signed-in user. */
export interface Bean {
  id: string
  roaster: string
  name: string
  origin: string | null
  region: string | null
  producer: string | null
  variety: string | null
  process: string | null
  altitudeM: number | null
  roastLevel: RoastLevel | null
  roasterNotes: string[]
}

export interface BeanMatch extends Bean {
  /** You already have a bag of it. */
  owned: boolean
  /** How many friends have a locked recipe for it. */
  friendsWithRecipe: number
}

/** Your own bag of a bean. Roast date and size are private to you. */
export interface Bag {
  id: string
  bean: Bean
  roastDate: string | null
  gramsRemaining: number | null
  status: BagStatus
  createdAt: string
}

export interface BagPatch {
  gramsRemaining?: number
  status?: BagStatus
}

export interface NewBean {
  roaster: string
  name: string
  origin?: string
  region?: string
  producer?: string
  variety?: string
  process?: string
  altitudeM?: number
  roastLevel?: RoastLevel
  roasterNotes: string[]
}

export interface AddBagInput {
  /** Minted on the device so the add can be retried safely and shown at once. */
  bagId: string
  beanId?: string
  newBean?: NewBean
  newBeanId?: string
  roastDate?: string | null
  grams?: number | null
}
