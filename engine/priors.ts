import { around, type Range } from './math.ts'
import { BLOOM_GAP_S } from './pours.ts'
import { processGroup } from './traits.ts'
import type { BeanTraits, FilterRef, FlowClass, Reason, RoastLevel } from './types.ts'
import { formatTemp } from './units.ts'

/**
 * Encoded V60 brewing guidance, not validated science. Every function returns a value, a range
 * and the reasons behind them, so the UI can always say why. See docs/engine.md section 4.
 */

export interface Estimate {
  value: number
  range: Range
  /** The reason for the value itself comes first; side notes (an assumed roast, the filter) follow. */
  reasons: Reason[]
}

export const describeTemp = (tempC: number) => formatTemp(tempC, 'c')
export const describeGrind = (grindUm: number) => `About ${grindUm} µm`

/** The bean's roast level, or light (and a reason saying so) when it is not set. */
function roastLevelOf(bean: BeanTraits): { level: RoastLevel; assumption: Reason[] } {
  if (bean.roastLevel) return { level: bean.roastLevel, assumption: [] }
  const assumption: Reason = {
    param: 'roast',
    what: 'Assumed a light roast',
    why: 'The roast level is not set on this bean. Set it to get a better starting temperature and grind.',
    source: 'assumption',
  }
  return { level: 'light', assumption: [assumption] }
}

const TEMP: Record<RoastLevel, { value: number; range: Range }> = {
  light: { value: 94, range: [92, 96] },
  medium: { value: 90, range: [88, 92] },
  dark: { value: 85, range: [83, 88] },
}

/**
 * Small process nudges (common guidance, unverified). A cooler nudge moves the range down with it;
 * a hotter one keeps the range, which already tops out at the hottest light washed brew in the dataset (96 °C).
 */
function processNudge(bean: BeanTraits, level: RoastLevel): { deltaC: number; why: string } {
  const group = processGroup(bean.process)
  if (group === 'natural' || group === 'anaerobic') {
    return { deltaC: -1, why: ` One degree cooler for a ${group} process, which often tastes sweeter and extracts easily (common guidance, unverified).` }
  }
  if (group === 'washed' && level === 'light') {
    return { deltaC: 1, why: ' One degree hotter for a washed light roast, which is dense (common guidance, unverified).' }
  }
  return { deltaC: 0, why: '' }
}

export function tempPrior(bean: BeanTraits): Estimate {
  const { level, assumption } = roastLevelOf(bean)
  const nudge = processNudge(bean, level)
  const value = TEMP[level].value + nudge.deltaC
  const [lo, hi] = TEMP[level].range
  const reason: Reason = {
    param: 'temp',
    what: describeTemp(value),
    why: `Starting point for a ${level} roast: lighter roasts are denser and need hotter water.${nudge.why}`,
    source: 'guidance',
  }
  const shift = Math.min(nudge.deltaC, 0)
  return { value, range: [lo + shift, hi + shift], reasons: [reason, ...assumption] }
}

/** Coarse, as the 4:6 method calls for; the grinder converter turns microns into its own setting. */
const GRIND_BASE_UM = 820
const GRIND_SPREAD_UM = 100

const GRIND_BY_ROAST: Record<RoastLevel, { offsetUm: number; why: string }> = {
  light: { offsetUm: 0, why: '' },
  medium: { offsetUm: 30, why: ', a touch coarser for a medium roast' },
  dark: { offsetUm: 60, why: ', coarser again for a dark roast, which extracts easily' },
}

const GRIND_BY_FLOW: Record<FlowClass, { offsetUm: number; what: string; why: string }> = {
  fast: {
    offsetUm: -30,
    what: 'A little finer for a fast paper',
    why: 'drains quickly, so the grind starts about 30 µm finer to keep the drawdown on target (small, unverified).',
  },
  medium: { offsetUm: 0, what: 'No filter adjustment', why: 'drains at a typical speed, so the grind is not adjusted for it.' },
  slow: {
    offsetUm: 30,
    what: 'A little coarser for a slow paper',
    why: 'drains slowly, so the grind starts about 30 µm coarser to avoid a long drawdown (small, unverified).',
  },
}

/** How the paper shifts the grind. An unknown flow class means no adjustment, and the reason says so. */
function filterAdjustment(filter: FilterRef | null | undefined): { offsetUm: number; reasons: Reason[] } {
  if (!filter) return { offsetUm: 0, reasons: [] }
  const name = `${filter.brand} ${filter.model}`
  const flow = filter.flowClass ? GRIND_BY_FLOW[filter.flowClass] : null
  const reason: Reason = flow
    ? { param: 'filter', what: flow.what, why: `${name} ${flow.why}`, source: 'guidance' }
    : { param: 'filter', what: 'No filter adjustment', why: `How fast ${name} drains is not known, so the grind is not adjusted for it.`, source: 'assumption' }
  return { offsetUm: flow?.offsetUm ?? 0, reasons: [reason] }
}

export function grindPrior(bean: BeanTraits, filter: FilterRef | null | undefined): Estimate {
  const roast = GRIND_BY_ROAST[roastLevelOf(bean).level]
  const paper = filterAdjustment(filter)
  const value = GRIND_BASE_UM + roast.offsetUm + paper.offsetUm
  const reason: Reason = {
    param: 'grind',
    what: describeGrind(value),
    why: `Coarse, as the 4:6 method calls for (about ${GRIND_BASE_UM} µm)${roast.why}. Your grinder converts this to its own setting.`,
    source: 'guidance',
  }
  return { value, range: around(value, GRIND_SPREAD_UM), reasons: [reason, ...paper.reasons] }
}

/** 1:15 whatever the strength: in the 4:6 method strength comes from the number of pours, not the ratio. */
const RATIO = 15
const RATIO_RANGE: Range = [14.5, 15.8]

export function ratioPrior(): Estimate {
  const reason: Reason = {
    param: 'ratio',
    what: `1:${RATIO}`,
    why: 'The 4:6 reference is 1:15. Strength is set by how many pours the last 60% of the water is split into, not by the ratio.',
    source: 'method',
  }
  return { value: RATIO, range: RATIO_RANGE, reasons: [reason] }
}

/** The 4:6 reference brew: 300 g of water, draining for about 55 s after the last pour starts. */
const REFERENCE_WATER_G = 300
const REFERENCE_DRAWDOWN_S = 55
/** Share of the drawdown that does not shrink with a smaller brew. */
const FIXED_DRAWDOWN_SHARE = 0.7
const TIME_SPREAD_S = 25

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Seconds of drawdown after the last pour, scaled for smaller or larger brews. */
export function targetTime(lastPourAtS: number, waterG: number): Estimate {
  const scale = FIXED_DRAWDOWN_SHARE + ((1 - FIXED_DRAWDOWN_SHARE) * waterG) / REFERENCE_WATER_G
  const value = Math.round((lastPourAtS + REFERENCE_DRAWDOWN_S * scale) / 5) * 5
  const reason: Reason = {
    param: 'time',
    what: `About ${minutes(value)} in total`,
    why: 'The last pour plus a short drawdown; the 4:6 reference finishes around 3:30 for 300 g (scaled for smaller brews, unverified).',
    source: 'guidance',
  }
  return { value, range: around(value, TIME_SPREAD_S), reasons: [reason] }
}

/** Milliseconds since the epoch for a real yyyy-mm-dd date, or null (so "2026-02-31" is refused). */
function parseDate(text: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const time = Date.parse(`${text}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(text) ? time : null
}

/** Days between two yyyy-mm-dd dates, or null when either is not a date. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from)
  const b = parseDate(to)
  return a === null || b === null ? null : Math.round((b - a) / 86_400_000)
}

/** Coffee roasted this recently still gives off a lot of gas and gets a longer bloom. */
const FRESH_DAYS = 7
const FRESH_EXTRA_BLOOM_S = 10

const roastedAgo = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)

/** Seconds before the second pour: the first pour is the bloom, and fresh coffee needs longer. */
export function bloomGap(roastDate: string | null | undefined, asOf: string | undefined): { gapS: number; reason: Reason | null } {
  const age = roastDate && asOf ? daysBetween(roastDate, asOf) : null
  if (age === null || age < 0 || age >= FRESH_DAYS) return { gapS: BLOOM_GAP_S, reason: null }
  return {
    gapS: BLOOM_GAP_S + FRESH_EXTRA_BLOOM_S,
    reason: {
      param: 'bloom',
      what: 'A longer bloom',
      why: `Roasted ${roastedAgo(age)}: fresh coffee gives off more gas, so the bloom gets ${FRESH_EXTRA_BLOOM_S} extra seconds (common guidance, unverified).`,
      source: 'guidance',
    },
  }
}
