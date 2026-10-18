// Compares the bag scan at low and medium effort on your own photos.
//
//   bun scripts/scan-eval.ts <folder-of-photos>
//
// Put 10-20 bag photos in a folder (JPEG, PNG, WebP or iPhone HEIC). The first run writes
// expected.json there, prefilled with what the scan read; correct it by hand (null for anything
// not on the label), then run again to get per-field accuracy, speed and cost for each effort.
// Uses the same prompt and schema as the app (supabase/functions/scan-bag/label.ts).
// Needs an Anthropic API key: ANTHROPIC_API_KEY, or an `ant auth login` profile.

import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { readScan, scanRequest, type ScanEffort, type ScannedBag } from '../supabase/functions/scan-bag/label.ts'

const EFFORTS: ScanEffort[] = ['low', 'medium']
/** Claude Haiku 5.5, USD per million tokens (prompts up to 100K tokens). */
const PRICE = { input: 0.1, output: 0.5 }
const FIELDS = [
  'roaster', 'name', 'origin', 'region', 'producer', 'variety', 'process',
  'altitudeM', 'roastLevel', 'tastingNotes', 'roastDate', 'weightG',
] as const
type Field = (typeof FIELDS)[number]
type Expected = Record<string, Partial<Pick<ScannedBag, Field>>>

interface Run {
  photo: string
  effort: ScanEffort
  ms: number
  inputTokens: number
  outputTokens: number
  scan?: ScannedBag
  error?: string
}

const folder = process.argv[2]
if (!folder || !existsSync(folder)) {
  console.error('Usage: bun scripts/scan-eval.ts <folder-of-photos>')
  process.exit(1)
}

const photos = readdirSync(folder)
  .filter((file) => ['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(extname(file).toLowerCase()))
  .sort()
if (photos.length === 0) {
  console.error(`No photos in ${folder}`)
  process.exit(1)
}

/** The same 1280 px JPEG the app sends. Uses macOS `sips`; elsewhere JPEGs are sent as they are. */
const scratch = mkdtempSync(join(tmpdir(), 'scan-eval-'))
function prepare(photo: string): string {
  const source = join(folder, photo)
  if (process.platform === 'darwin') {
    const out = join(scratch, `${photo}.jpg`)
    execFileSync('sips', ['-Z', '1280', '-s', 'format', 'jpeg', source, '--out', out], { stdio: 'ignore' })
    return readFileSync(out).toString('base64')
  }
  if (!['.jpg', '.jpeg'].includes(extname(photo).toLowerCase())) throw new Error('convert to JPEG first (sips is macOS only)')
  return readFileSync(source).toString('base64')
}

const client = new Anthropic()

async function scanOnce(photo: string, image: string, effort: ScanEffort): Promise<Run> {
  const started = performance.now()
  try {
    const response = await client.messages.create(scanRequest(image, 'image/jpeg', effort))
    const run: Run = {
      photo,
      effort,
      ms: performance.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
    const block = response.content.find((part) => part.type === 'text')
    if (response.stop_reason !== 'end_turn' || !block || block.type !== 'text') {
      return { ...run, error: `stopped: ${response.stop_reason}` }
    }
    return { ...run, scan: readScan(block.text) }
  } catch (error) {
    const message = error instanceof Anthropic.APIError ? `API ${error.status}: ${error.message}` : String(error)
    return { photo, effort, ms: performance.now() - started, inputTokens: 0, outputTokens: 0, error: message }
  }
}

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function same(field: Field, got: ScannedBag[Field], want: unknown): boolean {
  if (field === 'tastingNotes') {
    const a = new Set((got as string[]).map(key))
    const b = new Set(((want as string[] | null) ?? []).map(key))
    return a.size === b.size && [...a].every((note) => b.has(note))
  }
  if (got === null || want === null || want === undefined) return got === (want ?? null)
  if (typeof got === 'string' && typeof want === 'string') return key(got) === key(want)
  return got === want
}

const runs: Run[] = []
for (const photo of photos) {
  let image: string
  try {
    image = prepare(photo)
  } catch (error) {
    console.error(`Skipping ${photo}: ${String(error)}`)
    continue
  }
  for (const effort of EFFORTS) {
    process.stdout.write(`${photo} @ ${effort}… `)
    const run = await scanOnce(photo, image, effort)
    runs.push(run)
    console.log(run.error ? `failed (${run.error})` : `${Math.round(run.ms)} ms`)
  }
}

writeFileSync(join(folder, 'scan-eval-results.json'), JSON.stringify(runs, null, 2))

const expectedPath = join(folder, 'expected.json')
if (!existsSync(expectedPath)) {
  const template: Expected = {}
  for (const run of runs.filter((r) => r.effort === 'medium' && r.scan)) {
    template[run.photo] = Object.fromEntries(FIELDS.map((field) => [field, run.scan![field]]))
  }
  writeFileSync(expectedPath, JSON.stringify(template, null, 2))
  console.log(`\nWrote ${expectedPath} from the medium-effort reads.`)
  console.log('Correct it against the real labels (null for anything not printed), then run this again to score.')
  process.exit(0)
}

const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as Expected
console.log('\nMisses (field: got → expected)')
const summary = EFFORTS.map((effort) => {
  const mine = runs.filter((run) => run.effort === effort)
  let checked = 0
  let right = 0
  const perField = Object.fromEntries(FIELDS.map((field) => [field, { checked: 0, right: 0 }])) as Record<Field, { checked: number; right: number }>
  for (const run of mine) {
    const want = expected[run.photo]
    if (!want) continue
    for (const field of FIELDS) {
      if (!(field in want)) continue
      checked++
      perField[field].checked++
      const ok = run.scan !== undefined && same(field, run.scan[field], want[field])
      if (ok) {
        right++
        perField[field].right++
      } else {
        console.log(`  ${run.photo} @ ${effort}  ${field}: ${JSON.stringify(run.scan?.[field] ?? run.error)} → ${JSON.stringify(want[field])}`)
      }
    }
  }
  const ok = mine.filter((run) => !run.error)
  const average = (pick: (run: Run) => number) => (ok.length ? ok.reduce((sum, run) => sum + pick(run), 0) / ok.length : 0)
  const input = average((run) => run.inputTokens)
  const output = average((run) => run.outputTokens)
  const cost = (input * PRICE.input + output * PRICE.output) / 1_000_000
  return { effort, checked, right, perField, failed: mine.length - ok.length, ms: average((run) => run.ms), input, output, cost }
})

console.log('\nEffort  Accuracy        Failed  Avg time  Avg in/out tokens  Cost/scan   Cost/1000')
for (const row of summary) {
  const accuracy = row.checked ? `${((row.right / row.checked) * 100).toFixed(1)}% (${row.right}/${row.checked})` : 'n/a'
  console.log(
    `${row.effort.padEnd(8)}${accuracy.padEnd(16)}${String(row.failed).padEnd(8)}${`${(row.ms / 1000).toFixed(1)} s`.padEnd(10)}` +
      `${`${Math.round(row.input)} / ${Math.round(row.output)}`.padEnd(19)}${`$${row.cost.toFixed(5)}`.padEnd(12)}$${(row.cost * 1000).toFixed(2)}`,
  )
}

console.log('\nPer field (low vs medium)')
for (const field of FIELDS) {
  const cells = summary.map(({ perField }) => {
    const { checked, right } = perField[field]
    return checked ? `${right}/${checked}` : '-'
  })
  console.log(`  ${field.padEnd(13)}${cells.map((cell) => cell.padEnd(8)).join('')}`)
}
console.log(`\nRaw results: ${join(folder, 'scan-eval-results.json')}`)
