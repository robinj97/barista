// scan-bag: reads a coffee bag photo with Claude Haiku and returns the label as bag fields.
// Signed-in users only (the Supabase gateway checks the JWT), 10 scans each per day (claim_scan).
// The Anthropic key lives in the ANTHROPIC_API_KEY function secret and never reaches the app.
// Photos are not stored.

import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { DEFAULT_SCAN_EFFORT, readScan, scanRequest, SCAN_MODEL } from './label.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** About 2 MB of JPEG; the app sends ~0.3 MB after shrinking the photo to 1280 px. */
const MAX_BASE64_LENGTH = 3_000_000

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

/** One line per scan for the function logs: outcome, timing and tokens, nothing personal. */
function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event: 'scan', model: SCAN_MODEL, effort: DEFAULT_SCAN_EFFORT, ...fields }))
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  let image: unknown
  try {
    ;({ image } = await request.json())
  } catch {
    return reply(400, { error: 'invalid_body' })
  }
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_BASE64_LENGTH) {
    return reply(400, { error: 'invalid_image' })
  }

  // Count the scan as the caller, so the daily cap is per person and enforced by the database.
  const db = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: left, error: claimError } = await db.rpc('claim_scan')
  if (claimError) {
    console.error(JSON.stringify({ event: 'scan', outcome: 'claim_failed', message: claimError.message }))
    return reply(500, { error: 'scan_failed' })
  }
  if (left === -1) {
    log({ outcome: 'daily_limit' })
    return reply(429, { error: 'daily_limit' })
  }

  const started = Date.now()
  try {
    const response = await anthropic.messages.create(scanRequest(image, 'image/jpeg', DEFAULT_SCAN_EFFORT))
    const usage = { ms: Date.now() - started, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }
    if (response.stop_reason === 'refusal') {
      log({ outcome: 'refusal', ...usage })
      return reply(422, { error: 'unreadable' })
    }
    const block = response.content.find((part) => part.type === 'text')
    if (response.stop_reason === 'max_tokens' || !block || block.type !== 'text') {
      log({ outcome: 'incomplete', stop_reason: response.stop_reason, ...usage })
      return reply(502, { error: 'scan_incomplete' })
    }
    const scan = readScan(block.text)
    log({ outcome: scan.readable ? 'read' : 'unreadable', scans_left: left, ...usage })
    return reply(200, scan)
  } catch (error) {
    const ms = Date.now() - started
    if (error instanceof Anthropic.RateLimitError) {
      log({ outcome: 'anthropic_rate_limited', ms })
      return reply(429, { error: 'busy' })
    }
    if (error instanceof Anthropic.APIError) {
      log({ outcome: 'anthropic_error', status: error.status, message: error.message, ms })
      return reply(502, { error: 'scan_failed' })
    }
    if (error instanceof SyntaxError) {
      log({ outcome: 'unparseable', ms })
      return reply(502, { error: 'scan_failed' })
    }
    console.error(JSON.stringify({ event: 'scan', outcome: 'crashed', message: String(error), ms }))
    return reply(500, { error: 'scan_failed' })
  }
})
