// The suggest-tweak function's steps, with the database and Claude passed in so every path can be
// tested without either (handler.test.ts). index.ts wires in the real ones. See
// docs/suggest-tweak.md section 3.4.

import { buildInput, canSuggestFrom, readSuggestion, toStored, type StoredBean, type StoredBrew, type StoredChoices, type StoredSuggestion, type SuggestInput } from './suggest.ts'

export interface Draft {
  choices: StoredChoices
  lastBrew: StoredBrew | null
  suggestion: StoredSuggestion | null
}

export interface ClaudeAnswer {
  stopReason: string | null
  text: string | null
  inputTokens: number
  outputTokens: number
}

export interface Deps {
  hasFeature(): Promise<boolean>
  getDraft(beanId: string, method: string): Promise<Draft | null>
  getBean(beanId: string): Promise<StoredBean | null>
  /** Counts one suggestion; returns how many are left today, or -1 when none are. */
  claim(): Promise<number>
  ask(input: SuggestInput): Promise<ClaudeAnswer>
  saveSuggestion(beanId: string, method: string, suggestion: StoredSuggestion): Promise<void>
  log(fields: Record<string, unknown>): void
  now(): Date
}

export type Result =
  | { status: 200; body: { suggestion: StoredSuggestion; cached: boolean } }
  | { status: 400 | 403 | 409 | 429 | 502; body: { error: string } }

const error = (status: 400 | 403 | 409 | 429 | 502, code: string): Result => ({ status, body: { error: code } })

export async function handle(body: unknown, deps: Deps): Promise<Result> {
  const { beanId, method, brewedAt } = (body ?? {}) as Record<string, unknown>
  if (typeof beanId !== 'string' || method !== 'v60' || typeof brewedAt !== 'string') return error(400, 'invalid_body')

  if (!(await deps.hasFeature())) return error(403, 'not_enabled')

  const draft = await deps.getDraft(beanId, method)
  const brew = draft?.lastBrew
  if (!draft || !canSuggestFrom(brew)) return error(409, 'not_eligible')
  // The phone has a newer brew that hasn't synced: it should send it first, then ask again.
  if (brew.brewedAt !== brewedAt) return error(409, 'stale')

  if (draft.suggestion?.forBrewedAt === brewedAt) return { status: 200, body: { suggestion: draft.suggestion, cached: true } }

  const left = await deps.claim()
  if (left === -1) {
    deps.log({ outcome: 'daily_limit' })
    return error(429, 'daily_limit')
  }

  const input = buildInput(brew, draft.choices, await deps.getBean(beanId))
  const started = deps.now().getTime()
  let answer: ClaudeAnswer
  try {
    answer = await deps.ask(input)
  } catch (cause) {
    deps.log({ outcome: 'anthropic_error', message: String(cause), ms: deps.now().getTime() - started })
    return error(502, 'failed')
  }
  const usage = { ms: deps.now().getTime() - started, input_tokens: answer.inputTokens, output_tokens: answer.outputTokens }
  if (answer.stopReason !== 'end_turn' || !answer.text) {
    deps.log({ outcome: answer.stopReason === 'refusal' ? 'refusal' : 'incomplete', stop_reason: answer.stopReason, ...usage })
    return error(502, 'failed')
  }

  let suggestion: StoredSuggestion
  try {
    const checked = readSuggestion(answer.text, input.note)
    suggestion = toStored(checked, brewedAt, deps.now())
    deps.log({
      outcome: 'suggested',
      kind: checked.kind,
      changes: checked.changes.map((c) => c.direction),
      dropped: checked.dropped,
      oversized: checked.oversized,
      invented_quote: checked.inventedQuote,
      left,
      ...usage,
    })
  } catch {
    deps.log({ outcome: 'unparseable', ...usage })
    return error(502, 'failed')
  }

  await deps.saveSuggestion(beanId, method, suggestion)
  return { status: 200, body: { suggestion, cached: false } }
}
