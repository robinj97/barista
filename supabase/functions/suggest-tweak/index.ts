// suggest-tweak: suggests what to change next time from the last brew of a bean, with Claude Haiku.
// Signed-in users with the suggest_tweak feature only (the gateway checks the JWT, the database
// checks the feature), 20 suggestions each per day (claim_suggestion). Everything is read as the
// caller, so row-level security applies. The Anthropic key lives in the ANTHROPIC_API_KEY function
// secret and never reaches the app. See docs/suggest-tweak.md.

import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { handle, type Draft } from './handler.ts'
import { SUGGEST_EFFORT, SUGGEST_MODEL, suggestRequest, type StoredBean } from './suggest.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
/** The project's publishable key (new key system), or the legacy anon key on older projects. */
const PUBLISHABLE_KEY =
  (JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>).default ??
  Deno.env.get('SUPABASE_ANON_KEY') ??
  ''

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'invalid_body' })
  }

  const db = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const must = <T>({ data, error }: { data: T; error: { message: string } | null }): T => {
    if (error) throw new Error(error.message)
    return data
  }

  try {
    const result = await handle(body, {
      hasFeature: async () => must(await db.rpc('has_feature', { name: 'suggest_tweak' })) === true,
      getDraft: async (beanId, method) => {
        const row = must(await db.from('recipe_drafts').select('choices, last_brew, suggestion').eq('bean_id', beanId).eq('method', method).maybeSingle())
        return row ? ({ choices: row.choices ?? {}, lastBrew: row.last_brew, suggestion: row.suggestion } as Draft) : null
      },
      getBean: async (beanId) =>
        must(await db.from('beans').select('origin, process, roast_level, roaster_notes').eq('id', beanId).maybeSingle()) as StoredBean | null,
      claim: async () => must(await db.rpc('claim_suggestion')) as number,
      ask: async (input) => {
        const response = await anthropic.messages.create(suggestRequest(input, SUGGEST_MODEL, SUGGEST_EFFORT))
        const block = response.content.find((part) => part.type === 'text')
        return {
          stopReason: response.stop_reason,
          text: block && block.type === 'text' ? block.text : null,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }
      },
      saveSuggestion: async (beanId, method, suggestion) => {
        must(await db.from('recipe_drafts').update({ suggestion }).eq('bean_id', beanId).eq('method', method))
      },
      log: (fields) => console.log(JSON.stringify({ event: 'suggest', model: SUGGEST_MODEL, effort: SUGGEST_EFFORT, ...fields })),
      now: () => new Date(),
    })
    return reply(result.status, result.body)
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return reply(429, { error: 'busy' })
    console.error(JSON.stringify({ event: 'suggest', outcome: 'crashed', message: String(error) }))
    return reply(500, { error: 'failed' })
  }
})
