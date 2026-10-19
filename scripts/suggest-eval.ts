// Compares Claude Haiku 5.5 and Claude Sonnet 5.5 (low and medium effort) at suggesting the next
// tweak for a brew, on the cases in scripts/suggest-cases.ts.
//
//   bun scripts/suggest-eval.ts [--runs 2] [--only haiku|sonnet]
//
// Prints pass rate, harmful answers, how often both of two problems were fixed, whether small
// complaints got one change, which levers were picked, guardrail hits, speed and cost per
// configuration, and writes every answer to a Markdown file so the reasons can be read side by side.
// Uses the same prompt and schema as the app would (supabase/functions/suggest-tweak/suggest.ts).
// Needs an Anthropic API key: ANTHROPIC_API_KEY, or an `ant auth login` profile.
// One run of all cases costs roughly $0.30, nearly all of it Sonnet.

import Anthropic from '@anthropic-ai/sdk'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSuggestion, suggestRequest, type CheckedSuggestion, type SuggestEffort, type SuggestModel } from '../supabase/functions/suggest-tweak/suggest.ts'
import { CASES, type Answer, type Case } from './suggest-cases.ts'

/** USD per million tokens (Haiku: prompts up to 100K tokens). */
const PRICE: Record<SuggestModel, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
}

interface Config {
  name: string
  model: SuggestModel
  effort: SuggestEffort
}
const ALL_CONFIGS: Config[] = [
  { name: 'haiku low', model: 'claude-haiku-5-5', effort: 'low' },
  { name: 'haiku medium', model: 'claude-haiku-5-5', effort: 'medium' },
  { name: 'sonnet low', model: 'claude-sonnet-5-5', effort: 'low' },
  { name: 'sonnet medium', model: 'claude-sonnet-5-5', effort: 'medium' },
]

const arg = (flag: string) => {
  const at = process.argv.indexOf(flag)
  return at >= 0 ? process.argv[at + 1] : undefined
}
const runs = Math.max(1, Number(arg('--runs') ?? 1))
const only = arg('--only')
const configs = ALL_CONFIGS.filter((config) => !only || config.name.startsWith(only))
if (configs.length === 0) {
  console.error('Usage: bun scripts/suggest-eval.ts [--runs 2] [--only haiku|sonnet]')
  process.exit(1)
}

interface Run {
  config: Config
  case: Case
  ms: number
  inputTokens: number
  outputTokens: number
  suggestion?: CheckedSuggestion
  error?: string
}

const client = new Anthropic()

async function suggestOnce(config: Config, item: Case): Promise<Run> {
  const started = performance.now()
  try {
    const response = await client.messages.create(suggestRequest(item.input, config.model, config.effort))
    const run: Run = {
      config,
      case: item,
      ms: performance.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
    const block = response.content.find((part) => part.type === 'text')
    if (response.stop_reason !== 'end_turn' || !block || block.type !== 'text') {
      return { ...run, error: `stopped: ${response.stop_reason}` }
    }
    return { ...run, suggestion: readSuggestion(block.text, item.input.note) }
  } catch (error) {
    const message = error instanceof Anthropic.APIError ? `API ${error.status}: ${error.message}` : String(error)
    return { config, case: item, ms: performance.now() - started, inputTokens: 0, outputTokens: 0, error: message }
  }
}

/** What the answer did, as grading tokens: its directions, or "lock" / "advice". */
const answersOf = (s: CheckedSuggestion): Answer[] => (s.kind === 'change' ? s.changes.map((c) => c.direction) : [s.kind])
const describe = (s: CheckedSuggestion) =>
  s.kind === 'change' ? s.changes.map((c) => `${c.direction}${c.amount !== null ? ` ${c.amount}` : ''}`).join(' + ') : s.kind

type Grade = 'pass' | 'wrong' | 'miss' | 'failed'
function grade(run: Run): Grade {
  if (!run.suggestion) return 'failed'
  const answers = answersOf(run.suggestion)
  if (answers.some((answer) => run.case.wrong.includes(answer))) return 'wrong'
  if (!answers.every((answer) => run.case.needs.some((group) => group.includes(answer)))) return 'miss'
  if (run.case.maxChanges !== undefined && run.suggestion.changes.length > run.case.maxChanges) return 'miss'
  if (run.case.maxAmount !== undefined && (run.suggestion.changes[0]?.amount ?? 0) > run.case.maxAmount) return 'miss'
  return 'pass'
}
/** Every problem the brew shows got a fix. */
const complete = (run: Run) =>
  grade(run) === 'pass' && run.case.needs.every((group) => answersOf(run.suggestion!).some((answer) => group.includes(answer)))

// Four requests at a time, so a full run takes a minute or two rather than ten.
const jobs = configs.flatMap((config) => CASES.flatMap((item) => Array.from({ length: runs }, () => ({ config, item }))))
const results: Run[] = []
let next = 0
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < jobs.length) {
      const { config, item } = jobs[next++]!
      const run = await suggestOnce(config, item)
      results.push(run)
      console.log(`${config.name.padEnd(14)}${item.id.padEnd(24)}${run.error ? `failed (${run.error})` : `${grade(run)} ${describe(run.suggestion!)}`}`)
    }
  }),
)

const percent = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(0)}%` : 'n/a')
const pad = (text: string | number, width: number) => String(text).padEnd(width)

console.log(
  '\n' + pad('Config', 15) + pad('Pass', 13) + pad('Wrong', 7) + pad('Both fixed', 12) + pad('Small→1', 9) + pad('Avg chg', 9) +
    pad('Plan ok', 9) + pad('Temp test', 11) + pad('Guard', 7) + pad('Bad quote', 11) + pad('Failed', 8) + pad('Time', 7) +
    pad('In/out', 12) + pad('Cost/req', 11) + 'Cost/1000',
)
const summary = configs.map((config) => {
  const mine = results.filter((run) => run.config === config)
  const ok = mine.filter((run) => run.suggestion)
  const passes = mine.filter((run) => grade(run) === 'pass').length
  const wrong = mine.filter((run) => grade(run) === 'wrong').length
  const twoProblem = ok.filter((run) => run.case.needs.length > 1)
  const small = ok.filter((run) => run.case.maxChanges === 1)
  const withPlan = ok.filter((run) => run.case.plan)
  const tempCases = ok.filter((run) => run.case.tempIsTest && run.suggestion!.changes.some((c) => c.direction === 'hotter' || c.direction === 'cooler'))
  const changeRuns = ok.filter((run) => run.suggestion!.kind === 'change')
  const average = (list: Run[], pick: (run: Run) => number) => (list.length ? list.reduce((sum, run) => sum + pick(run), 0) / list.length : 0)
  const input = average(ok, (run) => run.inputTokens)
  const output = average(ok, (run) => run.outputTokens)
  const cost = (input * PRICE[config.model].input + output * PRICE[config.model].output) / 1_000_000
  const levers: Record<string, number> = {}
  for (const run of ok) for (const answer of answersOf(run.suggestion!)) levers[answer] = (levers[answer] ?? 0) + 1
  const row = {
    config: config.name,
    pass: `${percent(passes, mine.length)} (${passes}/${mine.length})`,
    wrong,
    bothFixed: `${twoProblem.filter(complete).length}/${twoProblem.length}`,
    smallSingle: `${small.filter((run) => run.suggestion!.changes.length <= 1).length}/${small.length}`,
    avgChanges: average(changeRuns, (run) => run.suggestion!.changes.length).toFixed(2),
    planOk: `${withPlan.filter((run) => run.suggestion!.plan === run.case.plan).length}/${withPlan.length}`,
    tempTest: `${tempCases.filter((run) => run.suggestion!.test).length}/${tempCases.length}`,
    guard: ok.filter((run) => run.suggestion!.dropped > 0 || run.suggestion!.oversized).length,
    badQuote: ok.filter((run) => run.suggestion!.inventedQuote).length,
    failed: mine.length - ok.length,
    ms: average(ok, (run) => run.ms),
    input,
    output,
    cost,
    levers,
  }
  console.log(
    pad(row.config, 15) + pad(row.pass, 13) + pad(row.wrong, 7) + pad(row.bothFixed, 12) + pad(row.smallSingle, 9) + pad(row.avgChanges, 9) +
      pad(row.planOk, 9) + pad(row.tempTest, 11) + pad(row.guard, 7) + pad(row.badQuote, 11) + pad(row.failed, 8) +
      pad(`${(row.ms / 1000).toFixed(1)} s`, 7) + pad(`${Math.round(input)}/${Math.round(output)}`, 12) + pad(`$${cost.toFixed(5)}`, 11) +
      `$${(cost * 1000).toFixed(2)}`,
  )
  return row
})

console.log('\nLevers picked (count of changes, plus lock and advice)')
const leverNames = ['finer', 'coarser', 'hotter', 'cooler', 'longer_gaps', 'shorter_gaps', 'tighter', 'looser', 'stronger', 'lighter', 'sweeter', 'brighter', 'lock', 'advice']
console.log(pad('', 15) + leverNames.map((name) => pad(name.replace('_gaps', ' gap'), 10)).join(''))
for (const row of summary) console.log(pad(row.config, 15) + leverNames.map((name) => pad(row.levers[name] ?? 0, 10)).join(''))

console.log('\nNot passed (case, config, grade, answer)')
for (const run of results.filter((r) => grade(r) !== 'pass').sort((a, b) => a.case.id.localeCompare(b.case.id))) {
  const answer = run.suggestion ? describe(run.suggestion) : run.error
  console.log(`  ${pad(run.case.id, 24)}${pad(run.config.name, 15)}${pad(grade(run), 7)}${answer}  (needs ${run.case.needs.map((g) => g.join('/')).join(' + ')})`)
}

// Every answer, grouped by case, for reading the reasons side by side.
const out = mkdtempSync(join(tmpdir(), 'suggest-eval-'))
const lines = ['# Suggestion eval', '', `${new Date().toISOString()} · ${runs} run(s) per case`, '']
for (const item of CASES) {
  lines.push(`## ${item.id}`, '', `Note: ${item.input.note.trim() ? `“${item.input.note.trim()}”` : '(none)'}`, '', `Needs: ${item.needs.map((g) => g.join('/')).join(' + ')}`, '')
  for (const run of results.filter((r) => r.case === item)) {
    const s = run.suggestion
    lines.push(
      s
        ? `- **${run.config.name}** · ${grade(run)} · ${describe(s)}${s.test ? ' · test' : ''} · plan ${s.plan}\n  ${s.reason}\n  _Look for:_ ${s.lookFor}`
        : `- **${run.config.name}** · failed · ${run.error}`,
    )
  }
  lines.push('')
}
writeFileSync(join(out, 'answers.md'), lines.join('\n'))
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2))
writeFileSync(join(out, 'results.json'), JSON.stringify(results.map((r) => ({ ...r, config: r.config.name, case: r.case.id })), null, 2))
console.log(`\nAnswers to read: ${join(out, 'answers.md')}`)
