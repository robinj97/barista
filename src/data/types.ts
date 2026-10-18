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

export interface Friend {
  id: string
  name: string
  avatarUrl: string | null
  since: string
}

/** A recipe a friend has locked. You see its numbers and the bean, nothing about their brews. */
export interface FriendRecipe extends LockedRecipeBase {
  friend: { id: string; name: string; avatarUrl: string | null }
}

export interface PendingInvite {
  id: string
  expiresAt: string
}

export interface InviterPreview {
  displayName: string
  avatarUrl: string | null
}

export type Taste = 'good' | 'sour' | 'bitter' | 'weak' | 'heavy' | 'astringent' | 'flat'
export const TASTE_LABELS: Record<Taste, string> = {
  good: 'Good',
  sour: 'Sour',
  bitter: 'Bitter',
  weak: 'Weak',
  heavy: 'Heavy',
  astringent: 'Astringent',
  flat: 'Flat',
}

/** What you want to be different next time. */
export type Improve = 'sweetness' | 'acidity' | 'body' | 'clarity' | 'less_bitter' | 'less_sour' | 'stronger' | 'weaker' | 'nothing'
export const IMPROVE_LABELS: Record<Improve, string> = {
  sweetness: 'More sweetness',
  acidity: 'More acidity',
  body: 'More body',
  clarity: 'More clarity',
  less_bitter: 'Less bitterness',
  less_sour: 'Less sourness',
  stronger: 'Stronger',
  weaker: 'Weaker',
  nothing: "Nothing, it's good",
}

export type Compared = 'sweeter' | 'more_acidity' | 'same'

/** A setting that is different from the brew before. */
export interface Change {
  param: 'dose' | 'water' | 'ratio' | 'temp' | 'grind'
  from: number
  to: number
}

/** What happened in a brew, as logged. */
export interface BrewResult {
  brewedAt: string
  /** Seconds from the start of the timer to the end of the drawdown. Null when the timer was not used. */
  totalTimeS: number | null
  /** How it tasted; any number. Empty when the log was skipped. */
  tastes: Taste[]
  /** What you want to improve next time; any number. */
  improve: Improve[]
  /** Older brews saved a single taste. Read it through `tastesOf`. */
  taste?: Taste | null
  /** Against the previous brew of this bean. Null when there was none or it was skipped. */
  compared: Compared | null
  yieldG: number | null
  notes: string
  /** Water in the first pour, so "sweeter or more acidity" can be checked against what changed. */
  firstPourG: number
  /** The numbers that were brewed. Missing on brews saved before this was kept. */
  recipe?: RecipeNumbers
  /** What was different from the brew before it. */
  changes?: Change[]
}

/** The tastes of a brew, including ones saved before more than one could be picked. */
export const tastesOf = (result: Pick<BrewResult, 'tastes' | 'taste'>): Taste[] => result.tastes ?? (result.taste ? [result.taste] : [])

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

/** What every locked recipe has, yours or a friend's. It carries its own bean, so it never depends on you having a bag of it. */
export interface LockedRecipeBase {
  id: string
  bean: Bean
  method: Method
  name: string
  lockedAt: string
  snapshot: RecipeSnapshot
}

/** A recipe you locked in. */
export interface LockedRecipe extends LockedRecipeBase {
  versionId: string
  rating: number | null
  /** How many times you brewed it, across all its versions. */
  brewCount: number
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

export type { ScannedBag } from '../../supabase/functions/scan-bag/label'

/** Why a bag photo could not be scanned, so the app can say something useful. */
export class ScanError extends Error {
  readonly reason: 'unreadable' | 'busy' | 'limit' | 'failed'
  constructor(reason: ScanError['reason']) {
    super(`scan_${reason}`)
    this.reason = reason
  }
}

/** How many beans `browseBeans` returns at most; at the cap the app searches the server instead. */
export const BROWSE_LIMIT = 1000

export interface SimilarBean {
  bean: BeanMatch
  /** The same coffee, spelled a little differently: it would be reused anyway. */
  exact: boolean
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
  /** When you marked the bag finished. Finished bags are kept (their brews and recipes stay) but left out of the way. */
  finishedAt?: string | null
}

export interface BagPatch {
  gramsRemaining?: number | null
  roastDate?: string | null
  status?: BagStatus
  finishedAt?: string | null
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
