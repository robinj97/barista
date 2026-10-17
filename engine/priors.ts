import type { BeanTraits, FilterRef, Reason, RoastLevel, Strength } from './types.ts'
import { processGroup } from './similarity.ts'

/**
 * Encoded brewing guidance, not validated science. Every function returns a value, a range
 * and the reasons behind them, so the UI can always say why. See docs/engine.md section 4.
 */

export interface Estimate {
  value: number
  range: [number, number]
  reasons: Reason[]
}

const round5 = (n: number) => Math.round(n / 5) * 5
const half = (n: number) => Math.round(n * 2) / 2
const roastName = (level: RoastLevel) => level

const TEMP: Record<RoastLevel, { value: number; range: [number, number] }> = {
  light: { value: 94, range: [92, 96] },
  medium: { value: 90, range: [88, 92] },
  dark: { value: 85, range: [83, 88] },
}

export function tempPrior(bean: BeanTraits): Estimate {
  const reasons: Reason[] = []
  const level: RoastLevel = bean.roastLevel ?? 'light'
  if (!bean.roastLevel) {
    reasons.push({
      param: 'temp',
      what: 'Assumed a light roast',
      why: 'The roast level is not set on this bean. Set it to get a better starting temperature.',
      source: 'assumption',
    })
  }

  let { value, range } = TEMP[level]
  const group = processGroup(bean.process)
  let nudge = ''
  if (group === 'natural' || group === 'anaerobic') {
    value -= 1
    range = [range[0] - 1, range[1] - 1]
    nudge = ` One degree cooler for a ${group} process, which often tastes sweeter and extracts easily (common guidance, unverified).`
  } else if (group === 'washed' && level === 'light') {
    value += 1
    range = [range[0], range[1]]
    nudge = ' One degree hotter for a washed light roast, which is dense (common guidance, unverified).'
  }

  reasons.push({
    param: 'temp',
    what: `${half(value)} °C`,
    why: `Starting point for a ${roastName(level)} roast: lighter roasts are denser and need hotter water.${nudge}`,
    source: 'guidance',
  })
  return { value: half(value), range: [Math.round(range[0]), Math.round(range[1])], reasons }
}

export function grindPrior(bean: BeanTraits, filter: FilterRef | null | undefined): Estimate {
  const reasons: Reason[] = []
  const level: RoastLevel = bean.roastLevel ?? 'light'
  let value = 820
  const parts: string[] = ['Coarse, as the 4:6 method calls for (about 820 µm)']

  if (level === 'medium') {
    value += 30
    parts.push('a touch coarser for a medium roast')
  } else if (level === 'dark') {
    value += 60
    parts.push('coarser again for a dark roast, which extracts easily')
  }

  if (filter?.flowClass === 'fast') {
    value -= 30
    reasons.push({
      param: 'filter',
      what: 'A little finer for a fast paper',
      why: `${filter.brand} ${filter.model} drains quickly, so the grind starts about 30 µm finer to keep the drawdown on target (small, unverified).`,
      source: 'guidance',
    })
  } else if (filter?.flowClass === 'slow') {
    value += 30
    reasons.push({
      param: 'filter',
      what: 'A little coarser for a slow paper',
      why: `${filter.brand} ${filter.model} drains slowly, so the grind starts about 30 µm coarser to avoid a long drawdown (small, unverified).`,
      source: 'guidance',
    })
  } else if (filter) {
    reasons.push({
      param: 'filter',
      what: 'No filter adjustment',
      why: `How fast ${filter.brand} ${filter.model} drains is not known, so the grind is not adjusted for it.`,
      source: 'assumption',
    })
  }

  reasons.push({
    param: 'grind',
    what: `About ${round5(value)} µm`,
    why: `${parts.join(', ')}. Your grinder converts this to its own setting.`,
    source: 'guidance',
  })
  return { value: round5(value), range: [round5(value - 100), round5(value + 100)], reasons }
}

const RATIO: Record<Strength, { value: number; range: [number, number] }> = {
  light: { value: 16, range: [15.5, 16.7] },
  medium: { value: 15, range: [14.5, 15.8] },
  strong: { value: 14, range: [13.5, 14.8] },
}

export function ratioPrior(strength: Strength): Estimate {
  const { value, range } = RATIO[strength]
  return {
    value,
    range,
    reasons: [
      {
        param: 'ratio',
        what: `1:${value}`,
        why: `The 4:6 reference is 1:15; a ${strength} cup is ${strength === 'strong' ? 'tightened towards 1:14' : strength === 'light' ? 'loosened towards 1:16' : 'kept at 1:15'}.`,
        source: 'method',
      },
    ],
  }
}

/** Seconds of drawdown after the last pour, scaled for smaller or larger brews. */
export function targetTime(lastPourAtS: number, waterG: number): Estimate {
  const drawdown = 55 * (0.7 + (0.3 * waterG) / 300)
  const value = Math.round((lastPourAtS + drawdown) / 5) * 5
  return {
    value,
    range: [value - 25, value + 25],
    reasons: [
      {
        param: 'time',
        what: `About ${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')} in total`,
        why: 'The last pour plus a short drawdown; the 4:6 reference finishes around 3:30 for 300 g (scaled for smaller brews, unverified).',
        source: 'guidance',
      },
    ],
  }
}

/** Days between two yyyy-mm-dd dates, or null when either is not a date. */
export function daysBetween(from: string, to: string): number | null {
  const parse = (text: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  }
  const a = parse(from)
  const b = parse(to)
  return a === null || b === null ? null : Math.round((b - a) / 86_400_000)
}

/** Seconds before the second pour: the first pour is the bloom, and fresh coffee needs longer. */
export function bloomGap(roastDate: string | null | undefined, asOf: string | undefined): { gapS: number; reason: Reason | null } {
  if (!roastDate || !asOf) return { gapS: 45, reason: null }
  const age = daysBetween(roastDate, asOf)
  if (age !== null && age >= 0 && age < 7) {
    return {
      gapS: 55,
      reason: {
        param: 'bloom',
        what: 'A longer first pour',
        why: `Roasted ${age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`}: fresh coffee gives off more gas, so the bloom gets 10 extra seconds (common guidance, unverified).`,
        source: 'guidance',
      },
    }
  }
  return { gapS: 45, reason: null }
}
