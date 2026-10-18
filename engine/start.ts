import { around, median, roundTo, weightedMean, widenTo, type Range } from './math.ts'
import { describeGrind, describeTemp, grindPrior, tempPrior, type Estimate } from './priors.ts'
import { nearestPriors } from './similarity.ts'
import type { ConfidenceInfo, PriorRecipe, Reason, SuggestInput } from './types.ts'

/** Where temperature and grind start, and how far to trust them. */
export interface Start {
  temp: Estimate
  grind: Estimate
  confidence: ConfidenceInfo
}

/**
 * The strongest source wins: your own locked recipes for this bean, then friends', then similar
 * coffees blended into the guidance, then the guidance alone. See docs/engine.md section 5.
 */
export function startingPoint(input: SuggestInput): Start {
  const forMethod = (priors: PriorRecipe[] = []) => priors.filter((p) => p.method === input.method)
  const own = forMethod(input.context?.own)
  const friends = forMethod(input.context?.friends)
  const guidance = guidanceStart(input)
  return (
    sameBeanStart(input, own, OWN) ??
    sameBeanStart(input, friends, FRIENDS) ??
    neighbourStart(input, [...own, ...friends], guidance) ??
    guidance
  )
}

function guidanceStart(input: SuggestInput): Start {
  return {
    temp: tempPrior(input.bean),
    grind: grindPrior(input.bean, input.filter),
    confidence: {
      level: 'low',
      source: 'guidance',
      basis: 'Based on the 4:6 method and general brewing guidance. No recipes for this bean or similar ones yet, so expect two or three brews to dial it in.',
    },
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

/** How much a locked recipe for the same bean is trusted, by whose it is. Friends' grind was converted from their grinder. */
const OWN = { level: 'high', tempSpreadC: 1, grindSpreadUm: 40, one: 'your locked recipe', many: 'of your locked recipes', converted: '' } as const
const FRIENDS = { level: 'medium', tempSpreadC: 1.5, grindSpreadUm: 60, one: "a friend's locked recipe", many: "friends' locked recipes", converted: ', converted from their grinder' } as const
type Trust = typeof OWN | typeof FRIENDS

/** "your locked recipe", "Sam's locked recipe", "locked recipes from Sam and Ava": who the numbers come from, in words. */
function describeWho(pool: PriorRecipe[], trust: Trust): string {
  const names = [...new Set(pool.map((p) => p.from?.trim()).filter((name): name is string => !!name))]
  if (trust !== FRIENDS || names.length === 0 || names.length > 3) return plural(pool.length, trust.one, trust.many)
  if (names.length === 1) return pool.length === 1 ? `${names[0]}'s locked recipe` : `${pool.length} of ${names[0]}'s locked recipes`
  return `locked recipes from ${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** Temperature and grind straight from locked recipes for this bean (the middle value of several). */
function sameBeanStart(input: SuggestInput, priors: PriorRecipe[], trust: Trust): Start | null {
  const pool = priors.filter((p) => !!input.bean.id && p.beanId === input.bean.id)
  if (pool.length === 0) return null
  const who = describeWho(pool, trust)
  const from = `Taken from ${who} for this bean${pool.length > 1 ? ' (the middle value)' : ''}`
  const tempC = roundTo(median(pool.map((p) => p.tempC)), 0.5)
  const grindUm = roundTo(median(pool.map((p) => p.grindUm)), 5)
  const { filter } = input
  const filterNote: Reason[] = filter
    ? [{ param: 'filter', what: 'No filter adjustment', why: `The grind comes from a recipe that already worked for this bean, so it is not adjusted for ${filter.brand} ${filter.model}.`, source: 'assumption' }]
    : []
  return {
    temp: { value: tempC, range: around(tempC, trust.tempSpreadC), reasons: [{ param: 'temp', what: describeTemp(tempC), why: `${from}.`, source: 'data' }] },
    grind: {
      value: grindUm,
      range: around(grindUm, trust.grindSpreadUm),
      reasons: [{ param: 'grind', what: describeGrind(grindUm), why: `${from}${trust.converted}.`, source: 'data' }, ...filterNote],
    },
    confidence: {
      level: trust.level,
      source: trust === OWN ? 'own' : 'friend',
      who,
      basis: `Based on ${who} for this bean${trust.converted ? '. Their grind is converted from their grinder, so small differences are normal' : ''}. The pour structure follows the balance and strength you chose.`,
    },
  }
}

/** Each similar coffee pulls the start this far, up to the cap; the rest stays guidance. */
const SHARE_PER_NEIGHBOUR = 0.15
const MAX_NEIGHBOUR_SHARE = 0.4
/** From this many neighbours the blend is trusted: the range tightens and confidence is medium. */
const TRUSTED_NEIGHBOURS = 3
const TRUSTED_TEMP_NARROWING = 0.7
const TRUSTED_GRIND_SPREAD_UM = 70

/** Guidance pulled towards recipes for similar coffees. Neighbours nudge and narrow, never override. */
function neighbourStart(input: SuggestInput, priors: PriorRecipe[], guidance: Start): Start | null {
  const neighbours = nearestPriors(input.bean, priors)
  if (neighbours.length === 0) return null
  const share = Math.min(MAX_NEIGHBOUR_SHARE, SHARE_PER_NEIGHBOUR * neighbours.length)
  const trusted = neighbours.length >= TRUSTED_NEIGHBOURS
  const count = plural(neighbours.length, '1 similar coffee', 'similar coffees')
  const why = `${Math.round(share * 100)}% comes from ${count} (matched on origin, process, roast, variety and notes); the rest is general guidance.`
  const pull = (guide: number, pick: (p: PriorRecipe) => number) =>
    (1 - share) * guide + share * weightedMean(neighbours.map((n) => [pick(n.prior), n.similarity]))

  const tempC = roundTo(pull(guidance.temp.value, (p) => p.tempC), 0.5)
  const grindUm = roundTo(pull(guidance.grind.value, (p) => p.grindUm), 5)
  const [lo, hi] = guidance.temp.range
  const tempSpread = ((hi - lo) / 2) * TRUSTED_TEMP_NARROWING
  const trustedTempRange: Range = [Math.round(tempC - tempSpread), Math.round(tempC + tempSpread)]

  return {
    temp: blend(guidance.temp, tempC, describeTemp(tempC), why, trusted ? trustedTempRange : guidance.temp.range),
    grind: blend(guidance.grind, grindUm, describeGrind(grindUm), why, trusted ? around(grindUm, TRUSTED_GRIND_SPREAD_UM) : guidance.grind.range),
    confidence: {
      level: trusted ? 'medium' : 'low',
      source: 'similar',
      basis: trusted
        ? `Based on the 4:6 method plus ${count} you or your friends have dialed in. Expect one or two brews to settle it.`
        : `Based on the 4:6 method plus ${count}, which is too few to rely on. Expect two or three brews.`,
    },
  }
}

/** The guidance estimate moved to `value`: its own reason becomes a data reason; side notes stay. */
function blend(guide: Estimate, value: number, what: string, why: string, range: Range): Estimate {
  const [own, ...sideNotes] = guide.reasons
  return {
    value,
    range: widenTo(range, value),
    reasons: [{ param: own!.param, what, why: `${why} Guidance alone gives ${own!.what}: ${own!.why}`, source: 'data' }, ...sideNotes],
  }
}
