// scan-bag: reads a coffee bag photo with Claude Haiku and returns the label as bag fields.
// Signed-in users only (the Supabase gateway checks the JWT). The Anthropic key lives in the
// ANTHROPIC_API_KEY function secret and never reaches the app. Photos are not stored.

import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { DEFAULT_SCAN_EFFORT, readScan, scanRequest } from './label.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** About 2 MB of JPEG; the app sends ~0.3 MB after shrinking the photo to 1280 px. */
const MAX_BASE64_LENGTH = 3_000_000

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
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

  try {
    const response = await client.messages.create(scanRequest(image, 'image/jpeg', DEFAULT_SCAN_EFFORT))
    if (response.stop_reason === 'refusal') return reply(422, { error: 'unreadable' })
    if (response.stop_reason === 'max_tokens') return reply(502, { error: 'scan_incomplete' })
    const block = response.content.find((part) => part.type === 'text')
    if (!block || block.type !== 'text') return reply(502, { error: 'scan_empty' })
    return reply(200, readScan(block.text))
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return reply(429, { error: 'busy' })
    if (error instanceof Anthropic.BadRequestError) return reply(400, { error: 'invalid_image' })
    if (error instanceof Anthropic.APIError) return reply(502, { error: 'scan_failed', status: error.status })
    if (error instanceof SyntaxError) return reply(502, { error: 'scan_unparseable' })
    console.error(error)
    return reply(500, { error: 'scan_failed' })
  }
})
