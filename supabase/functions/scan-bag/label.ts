// What Claude is asked to read off a coffee bag photo, and how its answer is cleaned up.
// Shared by the scan-bag Edge Function (Deno) and scripts/scan-eval.ts (Bun), so the app and
// the comparison script always use the same prompt and schema. No imports on purpose.

export const SCAN_MODEL = 'claude-haiku-5-5'
export type ScanEffort = 'low' | 'medium'
export const DEFAULT_SCAN_EFFORT: ScanEffort = 'low'

/** What the scan found. Every field is null when the label does not say. */
export interface ScannedBag {
  /** False when the photo is not a readable coffee label. */
  readable: boolean
  roaster: string | null
  name: string | null
  origin: string | null
  region: string | null
  producer: string | null
  variety: string | null
  process: string | null
  altitudeM: number | null
  roastLevel: 'light' | 'medium' | 'dark' | null
  tastingNotes: string[]
  /** ISO date, yyyy-mm-dd. */
  roastDate: string | null
  weightG: number | null
}

// Nullable fields as anyOf, the form structured outputs documents.
const text = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const whole = { anyOf: [{ type: 'integer' }, { type: 'null' }] }

export const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean' },
    roaster: text,
    name: text,
    origin: text,
    region: text,
    producer: text,
    variety: text,
    process: text,
    altitude_m: whole,
    roast_level: { anyOf: [{ type: 'string', enum: ['light', 'medium', 'dark'] }, { type: 'null' }] },
    tasting_notes: { type: 'array', items: { type: 'string' } },
    roast_date: text,
    weight_g: whole,
  },
  required: [
    'readable', 'roaster', 'name', 'origin', 'region', 'producer', 'variety', 'process',
    'altitude_m', 'roast_level', 'tasting_notes', 'roast_date', 'weight_g',
  ],
  additionalProperties: false,
} as const

export const SCAN_SYSTEM = `You read specialty coffee bag labels from photos and copy what they say into fields.

Rules:
- Only use what is printed or written on the bag. If a field is not on the label, return null (or an empty list). Never guess or fill in typical values.
- roaster: the company that roasted the coffee, usually the brand or logo. name: the coffee's own name, often a farm, lot or blend name. Do not repeat the roaster in the name.
- origin: the country. region: the area within it. producer: the farm, washing station or producer named.
- variety: as printed, e.g. "Gesha", "SL28, SL34". process: as printed, e.g. "Washed", "Anaerobic natural".
- altitude_m: metres above sea level as a whole number. For a range, give the higher number.
- roast_level: only if the bag states it (light, medium or dark); filter/espresso labels are not a roast level.
- tasting_notes: the flavour notes the roaster lists, lowercase, one per item.
- roast_date: the roast date only, never a best-before or packed-on date, as yyyy-mm-dd. Numeric dates on these bags are day first (03/04/2026 is 3 April 2026). If the year is missing, use the most recent past date that fits.
- weight_g: the bag's net weight in grams (convert kg and oz; round to whole grams).
- readable: false if the photo is not a coffee bag label or nothing on it can be read; then set every other field to null.`

/** The Messages API request for one photo; callers pass it straight to `messages.create`. */
export function scanRequest(imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', effort: ScanEffort) {
  return {
    model: SCAN_MODEL,
    max_tokens: 8000,
    system: SCAN_SYSTEM,
    output_config: { effort, format: { type: 'json_schema' as const, schema: SCAN_SCHEMA } },
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: imageBase64 } },
          { type: 'text' as const, text: 'Read this coffee bag label.' },
        ],
      },
    ],
  }
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed && trimmed.length <= max ? trimmed : null
}

function within(value: unknown, low: number, high: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high ? value : null
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * A real calendar date in the last two years, or null. Bags are never roasted in the future, but
 * the server runs on UTC, so "today" where the person is can already be tomorrow here.
 */
function roastDate(value: unknown, today: Date): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  const oldest = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
  const latest = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const iso = isoDay(date)
  return iso > isoDay(latest) || iso < isoDay(oldest) ? null : iso
}

/**
 * Turns Claude's JSON into a ScannedBag, dropping anything out of range rather than trusting it.
 * Throws when the answer is not the expected JSON object at all.
 */
export function readScan(json: string, today: Date = new Date()): ScannedBag {
  const raw = JSON.parse(json) as Record<string, unknown>
  if (typeof raw !== 'object' || raw === null) throw new Error('scan_not_an_object')
  const readable = raw.readable === true
  const roastLevel = raw.roast_level === 'light' || raw.roast_level === 'medium' || raw.roast_level === 'dark' ? raw.roast_level : null
  const notes = Array.isArray(raw.tasting_notes)
    ? [...new Set(raw.tasting_notes.map((note) => clean(note, 40)?.toLowerCase()).filter((note): note is string => Boolean(note)))].slice(0, 8)
    : []

  const scan: ScannedBag = {
    readable,
    roaster: clean(raw.roaster, 80),
    name: clean(raw.name, 120),
    origin: clean(raw.origin, 60),
    region: clean(raw.region, 80),
    producer: clean(raw.producer, 120),
    variety: clean(raw.variety, 80),
    process: clean(raw.process, 80),
    altitudeM: within(raw.altitude_m, 1, 5000),
    roastLevel,
    tastingNotes: notes,
    roastDate: roastDate(raw.roast_date, today),
    weightG: within(raw.weight_g, 1, 5000),
  }
  return readable ? scan : { ...EMPTY_SCAN }
}

export const EMPTY_SCAN: ScannedBag = {
  readable: false,
  roaster: null,
  name: null,
  origin: null,
  region: null,
  producer: null,
  variety: null,
  process: null,
  altitudeM: null,
  roastLevel: null,
  tastingNotes: [],
  roastDate: null,
  weightG: null,
}
