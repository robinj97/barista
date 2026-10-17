import { validateDose, validateOverrides } from './overrides.ts'
import { EngineError, STRENGTHS, type Method, type SuggestInput, type SuggestOutput } from './types.ts'
import { suggestV60 } from './v60.ts'

/** A method's recommender. It receives validated input and the dose in grams. */
type Recommender = (input: SuggestInput, doseG: number) => SuggestOutput

/** One recommender per method. AeroPress and espresso need their own research first. */
const RECOMMENDERS: Partial<Record<Method, Recommender>> = { v60: suggestV60 }

export function supportsMethod(method: Method): boolean {
  return RECOMMENDERS[method] !== undefined
}

/** One cup is 10 g of coffee, so 2 cups is the 20 g / 300 g reference recipe. */
const DOSE_PER_CUP_G = 10

/**
 * Suggest a starting recipe for a bean and a target flavour, with the reason for every
 * decision and an honest confidence. Pure and deterministic: the same input always gives the
 * same output. See docs/engine.md.
 */
export function suggest(input: SuggestInput): SuggestOutput {
  const recommend = RECOMMENDERS[input.method]
  if (!recommend) throw new EngineError('unsupported_method', `No suggestions for ${input.method} yet`)
  return recommend(input, validatedDose(input))
}

/** Rejects input the types cannot rule out (it may come from storage or a URL) and returns the dose. */
function validatedDose(input: SuggestInput): number {
  if (!Number.isFinite(input.target.balance)) throw new EngineError('invalid_input', 'Balance must be a number')
  if (!STRENGTHS.includes(input.target.strength)) throw new EngineError('invalid_input', `Unknown strength ${input.target.strength}`)
  const doseG = input.doseG ?? DOSE_PER_CUP_G * input.cups
  validateDose(doseG)
  validateOverrides(input.overrides)
  return doseG
}
