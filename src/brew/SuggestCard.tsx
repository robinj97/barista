import { useState } from 'react'
import { Button } from '../components/Button'
import { appliedNow, useSetSuggestionApplied, useSuggestTweak } from '../data/hooks'
import { SuggestError, type Draft } from '../data/types'
import type { RecipeModel } from '../recipe/model'
import type { BrewChoices } from './params'
import { applySuggestion, currentSuggestion } from './suggestTweak'

interface SuggestCardProps {
  model: RecipeModel
  /** The working recipe whose last brew is read. */
  draft: Draft
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
export function SuggestCard({ model, draft }: SuggestCardProps) {
  const { choices, recipe, grinder, unit, apply, recompute } = model
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
        <Button variant="accent" size="md" onClick={request} disabled={ask.isPending} className="text-sm disabled:opacity-60">
          {ask.isPending ? 'Thinking…' : reason ? 'Try again' : '✦ Suggest a tweak'}
        </Button>
        {!reason && <p className="mt-1.5 text-center text-xs text-muted">AI reads this brew and your note.</p>}
      </div>
    )
  }

  if (folded) {
    return (
      <Button variant="quiet" size="md" block={false} onClick={() => setFolded(false)} className="mt-2 px-3">
        See suggestion ›
      </Button>
    )
  }

  const applied =
    suggestion.kind === 'change'
      ? // After Apply, describe it against the choices from before Apply, which Undo goes back to.
        applySuggestion({
          choices: undo ?? choices,
          current: recipe,
          brewed: brew.recipe!,
          brewedChoices: draft.choices,
          changes: suggestion.changes,
          grinder,
          unit,
          recompute,
        })
      : null
  const isApplied = undo !== null || suggestion.appliedAt !== null

  const onApply = () => {
    if (!applied?.choices) return
    setUndo(choices)
    apply(applied.choices)
    setApplied.mutate({ beanId: draft.beanId, appliedAt: appliedNow() })
  }
  const onUndo = () => {
    if (!undo) return
    apply(undo)
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
          <Button size="md" onClick={onApply} className="flex-1 text-sm">
            Apply to recipe
          </Button>
          <Button variant="quiet" size="md" block={false} onClick={() => setFolded(true)} className="px-4">
            Not now
          </Button>
        </div>
      )}
      {isApplied && (
        <p className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-muted">Applied</span>
          {undo && (
            <Button variant="quiet" size="md" block={false} onClick={onUndo} className="px-3 text-accent">
              Undo
            </Button>
          )}
        </p>
      )}
      {(!applied || !applied.choices) && (
        <Button variant="quiet" size="md" block={false} onClick={() => setFolded(true)} className="mt-2 px-3">
          OK
        </Button>
      )}
    </section>
  )
}
