import { useState } from 'react'
import type { TempUnit } from '../../engine/units.ts'
import { appliedNow, useSetSuggestionApplied, useSuggestTweak } from '../data/hooks'
import { SuggestError, type Draft, type MyGrinder, type RecipeNumbers } from '../data/types'
import type { BrewChoices } from './params'
import { applySuggestion, currentSuggestion } from './suggestTweak'

interface SuggestCardProps {
  draft: Draft
  choices: BrewChoices
  /** The recipe on screen now. */
  current: RecipeNumbers
  recompute: (choices: BrewChoices) => RecipeNumbers
  grinder: MyGrinder | undefined
  unit: TempUnit
  onApply: (choices: BrewChoices) => void
}

const ERRORS: Record<SuggestError['reason'], string | null> = {
  offline: "You're offline. Suggestions need a connection.",
  limit: "That's all your suggestions for today. More tomorrow.",
  failed: "Couldn't get a suggestion just now.",
  stale: "Couldn't get a suggestion just now.",
  // Nothing to show: the button shouldn't have been there.
  not_eligible: null,
  not_enabled: null,
}

/**
 * "Suggest a tweak", inside the last brew card (docs/suggest-tweak.md). Runs only when tapped. The
 * answer is kept on the draft, so reopening the screen shows it again without asking.
 */
export function SuggestCard({ draft, choices, current, recompute, grinder, unit, onApply }: SuggestCardProps) {
  const ask = useSuggestTweak()
  const setApplied = useSetSuggestionApplied()
  const [folded, setFolded] = useState(false)
  const [undo, setUndo] = useState<BrewChoices | null>(null)
  const [failures, setFailures] = useState(0)
  const brew = draft.lastBrew!
  const suggestion = currentSuggestion(draft)

  const request = () =>
    ask.mutate({ beanId: draft.beanId, brewedAt: brew.brewedAt }, { onError: () => setFailures((n) => n + 1), onSuccess: () => setFolded(false) })

  if (!suggestion) {
    const reason = ask.error instanceof SuggestError ? ask.error.reason : ask.error ? 'failed' : null
    if (reason && ERRORS[reason] === null) return null
    // After a second failure the button goes until the screen is opened again.
    if (reason === 'limit' || failures >= 2) return reason ? <p className="mt-3 text-center text-xs text-muted">{ERRORS[reason]}</p> : null
    return (
      <div className="mt-3">
        {reason && <p className="mb-2 text-center text-xs text-muted">{ERRORS[reason]}</p>}
        <button
          type="button"
          onClick={request}
          disabled={ask.isPending}
          className="h-11 w-full rounded-full border border-hairline bg-bg text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {ask.isPending ? 'Thinking…' : reason ? 'Try again' : '✦ Suggest a tweak'}
        </button>
        {!reason && <p className="mt-1.5 text-center text-xs text-muted">AI reads this brew and your note.</p>}
      </div>
    )
  }

  if (folded) {
    return (
      <button type="button" onClick={() => setFolded(false)} className="mt-2 h-9 rounded-full px-3 text-sm text-accent">
        See suggestion ›
      </button>
    )
  }

  const brewed = brew.recipe!
  const applied =
    suggestion.kind === 'change'
      ? // After Apply, describe it against the choices from before Apply, which Undo goes back to.
        applySuggestion({ choices: undo ?? choices, current, brewed, brewedChoices: draft.choices, changes: suggestion.changes, grinder, unit, recompute })
      : null
  const isApplied = undo !== null || suggestion.appliedAt !== null

  const apply = () => {
    if (!applied?.choices) return
    setUndo(choices)
    onApply(applied.choices)
    setApplied.mutate({ beanId: draft.beanId, appliedAt: appliedNow() })
  }
  const revert = () => {
    if (!undo) return
    onApply(undo)
    setUndo(null)
    setApplied.mutate({ beanId: draft.beanId, appliedAt: null })
  }

  return (
    <section aria-label="Suggestion" className="mt-3 border-t border-hairline pt-3">
      <p className="text-xs text-muted">
        ✦ Suggestion{suggestion.test && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-accent">Test</span>}
      </p>
      {suggestion.kind === 'lock' && <p className="mt-1 font-medium">This one sounds like a keeper.</p>}
      {suggestion.kind === 'advice' && <p className="mt-1 font-medium">Try this first:</p>}
      {applied && (
        <ul className="mt-1 space-y-0.5">
          {applied.lines.map((line) => (
            <li key={line.text} className={line.atLimit ? 'text-sm text-muted' : 'font-medium'}>
              {line.atLimit ? line.text : `Try: ${line.text}`}
              {line.alreadyChanged && !line.atLimit && <span className="block text-xs font-normal text-muted">You'd already changed this; Apply sets the suggested value.</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm">{suggestion.reason}</p>
      {suggestion.kind === 'lock' && <p className="mt-1 text-sm">Brew it the same way, and turn on Lock in when you log it.</p>}
      {applied && !applied.choices && <p className="mt-1 text-sm text-muted">That's already at the limit, so there's nothing to change here.</p>}
      {suggestion.lookFor && (
        <p className="mt-2 text-xs text-muted">
          <span className="font-medium">Look for:</span> {suggestion.lookFor}
        </p>
      )}

      {applied?.choices && !isApplied && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={apply} className="h-11 flex-1 rounded-full bg-ink text-sm font-medium text-bg active:scale-[0.98]">
            Apply to recipe
          </button>
          <button type="button" onClick={() => setFolded(true)} className="h-11 rounded-full px-4 text-sm text-muted">
            Not now
          </button>
        </div>
      )}
      {isApplied && (
        <p className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-muted">Applied</span>
          {undo && (
            <button type="button" onClick={revert} className="h-9 rounded-full px-3 text-sm text-accent">
              Undo
            </button>
          )}
        </p>
      )}
      {(!applied || !applied.choices) && (
        <button type="button" onClick={() => setFolded(true)} className="mt-2 h-9 rounded-full px-3 text-sm text-accent">
          OK
        </button>
      )}
    </section>
  )
}
