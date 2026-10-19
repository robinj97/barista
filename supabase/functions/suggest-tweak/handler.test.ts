import { describe, expect, it, vi } from 'vitest'
import { handle, type ClaudeAnswer, type Deps, type Draft } from './handler'

const BREWED_AT = '2026-10-19T08:00:03.102Z'

const draft = (over: Partial<Draft> = {}): Draft => ({
  choices: { balance: -0.6, strength: 'medium' },
  lastBrew: {
    brewedAt: BREWED_AT,
    totalTimeS: null,
    tastes: ['weak', 'flat'],
    improve: ['sweetness', 'body'],
    compared: null,
    notes: 'Need to go finer next time.',
    recipe: { doseG: 16.9, waterG: 270, ratio: 16, tempC: 92, grindUm: 711, targetTimeS: 210, pours: [{ atS: 0, toG: 43 }, { atS: 45, toG: 108 }] },
  },
  suggestion: null,
  ...over,
})

const answer = (over: Partial<ClaudeAnswer> = {}): ClaudeAnswer => ({
  stopReason: 'end_turn',
  text: JSON.stringify({ kind: 'change', changes: [{ direction: 'finer', amount: 30 }], test: false, reason: 'r', quote: 'go finer', look_for: 'l', plan: 'agrees' }),
  inputTokens: 2000,
  outputTokens: 400,
  ...over,
})

function deps(over: Partial<Deps> = {}): Deps {
  return {
    hasFeature: vi.fn(async () => true),
    getDraft: vi.fn(async () => draft()),
    getBean: vi.fn(async () => ({ origin: 'Rwanda', process: 'Natural', roast_level: null, roaster_notes: [] })),
    claim: vi.fn(async () => 19),
    ask: vi.fn(async () => answer()),
    saveSuggestion: vi.fn(async () => {}),
    log: vi.fn(),
    now: () => new Date('2026-10-19T09:00:00Z'),
    ...over,
  }
}

const body = { beanId: 'bean-1', method: 'v60', brewedAt: BREWED_AT }

describe('suggest-tweak handler', () => {
  it('suggests, saves and returns a fresh suggestion', async () => {
    const d = deps()
    const result = await handle(body, d)
    expect(result.status).toBe(200)
    if (result.status !== 200) return
    expect(result.body.cached).toBe(false)
    expect(result.body.suggestion).toMatchObject({ forBrewedAt: BREWED_AT, kind: 'change', changes: [{ direction: 'finer', amount: 30 }], appliedAt: null, promptVersion: '3' })
    expect(d.saveSuggestion).toHaveBeenCalledWith('bean-1', 'v60', result.body.suggestion)
    const input = vi.mocked(d.ask).mock.calls[0]![0]
    expect(input.recipe).toMatchObject({ grindUm: 711, balance: -0.6, strength: 'medium', pourStartsS: [0, 45] })
    expect(input.note).toBe('Need to go finer next time.')
  })

  it('refuses a body it cannot read', async () => {
    expect((await handle({ beanId: 'bean-1' }, deps())).status).toBe(400)
    expect((await handle({ ...body, method: 'espresso' }, deps())).status).toBe(400)
  })

  it('refuses people without the feature before reading anything or calling Claude', async () => {
    const d = deps({ hasFeature: vi.fn(async () => false) })
    expect(await handle(body, d)).toEqual({ status: 403, body: { error: 'not_enabled' } })
    expect(d.getDraft).not.toHaveBeenCalled()
    expect(d.claim).not.toHaveBeenCalled()
    expect(d.ask).not.toHaveBeenCalled()
  })

  it('refuses drafts without what a suggestion needs', async () => {
    const lastBrew = draft().lastBrew!
    for (const d of [
      null,
      draft({ lastBrew: null }),
      draft({ lastBrew: { ...lastBrew, recipe: undefined } }),
      draft({ lastBrew: { ...lastBrew, tastes: [], notes: '' } }),
    ]) {
      const result = await handle(body, deps({ getDraft: vi.fn(async () => d) }))
      expect(result).toEqual({ status: 409, body: { error: 'not_eligible' } })
    }
  })

  it('accepts a brew with only a note, or only a taste', async () => {
    const lastBrew = draft().lastBrew!
    expect((await handle(body, deps({ getDraft: vi.fn(async () => draft({ lastBrew: { ...lastBrew, tastes: [] } })) }))).status).toBe(200)
    expect((await handle(body, deps({ getDraft: vi.fn(async () => draft({ lastBrew: { ...lastBrew, notes: '' } })) }))).status).toBe(200)
  })

  it('says stale when the phone has a newer brew than the server', async () => {
    const d = deps()
    expect(await handle({ ...body, brewedAt: '2026-10-20T08:00:00Z' }, d)).toEqual({ status: 409, body: { error: 'stale' } })
    expect(d.ask).not.toHaveBeenCalled()
  })

  it('returns the saved suggestion for the same brew without counting or calling Claude', async () => {
    const saved = (await handle(body, deps())) as { body: { suggestion: Draft['suggestion'] } }
    const d = deps({ getDraft: vi.fn(async () => draft({ suggestion: saved.body.suggestion })) })
    const result = await handle(body, d)
    expect(result).toEqual({ status: 200, body: { suggestion: saved.body.suggestion, cached: true } })
    expect(d.claim).not.toHaveBeenCalled()
    expect(d.ask).not.toHaveBeenCalled()
  })

  it('asks again when the saved suggestion is for an older brew', async () => {
    const saved = (await handle(body, deps())) as { body: { suggestion: NonNullable<Draft['suggestion']> } }
    const old = { ...saved.body.suggestion, forBrewedAt: '2026-10-18T08:00:00Z' }
    const d = deps({ getDraft: vi.fn(async () => draft({ suggestion: old })) })
    expect((await handle(body, d)).status).toBe(200)
    expect(d.ask).toHaveBeenCalledOnce()
  })

  it('stops at the daily limit', async () => {
    const d = deps({ claim: vi.fn(async () => -1) })
    expect(await handle(body, d)).toEqual({ status: 429, body: { error: 'daily_limit' } })
    expect(d.ask).not.toHaveBeenCalled()
  })

  it('fails without saving on a refusal, an incomplete answer, bad JSON or an API error', async () => {
    for (const ask of [
      vi.fn(async () => answer({ stopReason: 'refusal', text: null })),
      vi.fn(async () => answer({ stopReason: 'max_tokens' })),
      vi.fn(async () => answer({ text: 'not json' })),
      vi.fn(async () => {
        throw new Error('overloaded')
      }),
    ]) {
      const d = deps({ ask })
      expect(await handle(body, d)).toEqual({ status: 502, body: { error: 'failed' } })
      expect(d.saveSuggestion).not.toHaveBeenCalled()
    }
  })

  it('logs outcome and tokens, and nothing from the note', async () => {
    const d = deps()
    await handle(body, d)
    const line = vi.mocked(d.log).mock.calls[0]![0]
    expect(line).toMatchObject({ outcome: 'suggested', kind: 'change', changes: ['finer'], input_tokens: 2000, output_tokens: 400 })
    expect(JSON.stringify(line)).not.toContain('finer next time')
  })
})
