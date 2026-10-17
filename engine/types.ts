/** Shared engine types. Pure data: no UI, database or network code lives in `engine/`. */

export type Method = 'v60' | 'aeropress' | 'espresso'
export type RoastLevel = 'light' | 'medium' | 'dark'
export type Strength = 'light' | 'medium' | 'strong'
export type FlowClass = 'fast' | 'medium' | 'slow'

export interface FilterRef {
  id: string
  brand: string
  model: string
  /** How fast the paper drains. Unknown means no adjustment. */
  flowClass?: FlowClass | null
}

/** What is true of the coffee itself (the shared catalogue's static facts). */
export interface BeanTraits {
  origin?: string | null
  region?: string | null
  process?: string | null
  variety?: string | null
  roastLevel?: RoastLevel | null
  altitudeM?: number | null
  /** The roaster's tasting notes. */
  notes: string[]
}

export interface Pour {
  /** Seconds from the first pour. */
  atS: number
  /** Cumulative grams on the scale after this pour, as in the dataset. */
  toG: number
}

/** A recipe someone already locked, used as data for the suggestion. */
export interface PriorRecipe {
  source: 'own' | 'friend'
  method: Method
  beanId: string
  bean: BeanTraits
  tempC: number
  /** Microns, already converted from the other person's grinder. */
  grindUm: number
  ratio: number
}

export interface SuggestInput {
  method: Method
  bean: BeanTraits & { id?: string; roastDate?: string | null }
  target: {
    /** -1 sweeter ... +1 brighter. Values outside the range are clamped. */
    balance: number
    strength: Strength
    /** Tasting notes the user wants to bring out. They nudge the balance. */
    emphasise: string[]
  }
  /** One cup is 10 g of coffee, so 2 cups is the 20 g / 300 g reference recipe. */
  cups: number
  /** Overrides cups when the user sets an exact dose. */
  doseG?: number
  filter?: FilterRef | null
  /** Recipes to learn from. Own wins over friends, and same-bean beats similar beans. */
  context?: { own: PriorRecipe[]; friends: PriorRecipe[] }
  /** Today as yyyy-mm-dd, for roast freshness. Omit and freshness is ignored (keeps the engine pure). */
  asOf?: string
}

export type ReasonParam = 'structure' | 'balance' | 'temp' | 'grind' | 'ratio' | 'time' | 'bloom' | 'filter' | 'dose'
export type ReasonSource = 'method' | 'guidance' | 'data' | 'assumption'

export interface Reason {
  param: ReasonParam
  what: string
  why: string
  source: ReasonSource
}

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface SuggestOutput {
  recipe: {
    doseG: number
    waterG: number
    ratio: number
    tempC: number
    grindUm: number
    filter: FilterRef | null
    pours: Pour[]
    agitation: string | null
    targetTimeS: number
  }
  /** The balance and pour count actually used, after notes and clamping. */
  structure: { balance: number; laterPours: number }
  ranges: Partial<Record<'tempC' | 'grindUm' | 'ratio' | 'targetTimeS', [number, number]>>
  reasons: Reason[]
  confidence: { level: ConfidenceLevel; basis: string }
}

export class EngineError extends Error {
  code: 'unsupported_method' | 'invalid_input'

  constructor(code: 'unsupported_method' | 'invalid_input', message: string) {
    super(message)
    this.name = 'EngineError'
    this.code = code
  }
}
