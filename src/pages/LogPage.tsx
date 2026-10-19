import { useState } from 'react'
import { useNavigate } from 'react-router'
import { suggest } from '../../engine/suggest.ts'
import { BeanHeader } from '../beans/BeanHeader'
import { afterLock, isEmpty } from '../brew/bagUsage'
import { buildSuggestInput, clock } from '../brew/buildInput'
import { diffRecipes, toggleExclusive } from '../brew/feedback'
import { parseChoices } from '../brew/params'
import { clearSession, readSession } from '../brew/session'
import { currentSuggestion } from '../brew/suggestTweak'
import { useBrewSelection } from '../brew/useBrewSelection'
import { ChipGroup } from '../components/ChipGroup'
import { MultiChipGroup } from '../components/MultiChipGroup'
import { Switch } from '../components/Switch'
import { useToast } from '../components/toastContext'
import { useLockRecipe, useMyDrafts, useSaveDraft, useUpdateBag } from '../data/hooks'
import { IMPROVE_LABELS, TASTE_LABELS, type BrewResult, type Compared, type Improve, type RecipeNumbers, type Taste } from '../data/types'
import { Button } from '../components/Button'
import { LoadingNote } from '../components/LoadingNote'
import { SectionHeading } from '../components/SectionHeading'

const TASTES = (Object.keys(TASTE_LABELS) as Taste[]).map((value) => ({ value, label: TASTE_LABELS[value] }))
const IMPROVES = (Object.keys(IMPROVE_LABELS) as Improve[]).map((value) => ({ value, label: IMPROVE_LABELS[value] }))
const COMPARED: { value: Compared; label: string }[] = [
  { value: 'sweeter', label: 'Sweeter' },
  { value: 'more_acidity', label: 'More acidity' },
  { value: 'same', label: 'About the same' },
]

/**
 * After a brew: how it went. The app holds you here until it is done (or skipped), and the brew
 * waits on the phone, so coming back hours later finds this screen as you left it. Saves your
 * working recipe; locking it in also keeps it for good.
 */
export function LogPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [session] = useState(readSession)
  const choices = parseChoices(new URLSearchParams(session?.search ?? ''))
  const selection = useBrewSelection(choices)
  const drafts = useMyDrafts()
  const saveDraft = useSaveDraft()
  const lockRecipe = useLockRecipe()
  const updateBag = useUpdateBag()
  // Minted once so a retry after a dropped connection cannot save the brew twice.
  const [ids] = useState(() => ({ recipe: crypto.randomUUID(), version: crypto.randomUUID(), brew: crypto.randomUUID() }))

  const [tastes, setTastes] = useState<Taste[]>([])
  const [improve, setImprove] = useState<Improve[]>([])
  const [compared, setCompared] = useState<Compared | null>(null)
  const [yieldText, setYieldText] = useState('')
  const [notes, setNotes] = useState('')
  const [lock, setLock] = useState(false)
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState(false)

  const discard = () => {
    clearSession()
    void navigate('/brew')
  }

  if (!session || session.finishedS === null) {
    return (
      <>
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Nothing to log</h1>
        <p className="mt-2 text-sm text-muted">Finish a brew and it will show up here.</p>
      </>
    )
  }
  if (selection.bags.isError) {
    return (
      <>
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Couldn't load your beans</h1>
        <p className="mt-2 text-sm text-muted">Your brew is safe on this phone. Check your connection and try again.</p>
        <Button onClick={() => void selection.bags.refetch()} className="mt-4">
          Try again
        </Button>
      </>
    )
  }
  if (selection.bags.isPending || drafts.isPending) {
    return (
      <LoadingNote />
    )
  }
  const { bag } = selection
  // A bag that is gone must not quietly fall back to another one.
  if (!bag || selection.bagMissing) {
    return (
      <>
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Bean not found</h1>
        <p className="mt-2 text-sm text-muted">That bag isn't in your beans any more, so this brew can't be logged.</p>
        <Button onClick={discard} className="mt-4">
          Discard this brew
        </Button>
      </>
    )
  }

  // The numbers that were brewed. Older sessions did not keep them, so work them out again.
  const brewed = session.recipe ?? suggest(buildSuggestInput(bag, choices, selection.filter?.filter ?? null, session.asOf)).recipe
  const recipe: RecipeNumbers = { doseG: brewed.doseG, waterG: brewed.waterG, ratio: brewed.ratio, tempC: brewed.tempC, grindUm: brewed.grindUm, targetTimeS: brewed.targetTimeS, pours: brewed.pours }
  const previousDraft = drafts.data?.find((d) => d.beanId === bag.bean.id && d.method === 'v60')
  const previous = previousDraft?.lastBrew ?? null
  const asked = currentSuggestion(previousDraft)
  const yieldG = Number(yieldText)
  const yieldOk = yieldText.trim() === '' || (Number.isFinite(yieldG) && yieldG > 0)
  const canSave = !saving && yieldOk && tastes.length > 0 && (!lock || rating > 0)

  const facts = {
    brewedAt: new Date(session.startedAt).toISOString(),
    totalTimeS: session.untimed ? null : session.finishedS,
    firstPourG: recipe.pours[0]?.toG ?? 0,
    recipe,
    changes: previous?.recipe ? diffRecipes(previous.recipe, recipe) : undefined,
    followed: asked?.kind === 'change' ? { directions: asked.changes.map((c) => c.direction), applied: asked.appliedAt !== null } : undefined,
  }

  /** `skip` records the brew itself (time, numbers) and nothing about taste, and lets you on. */
  const save = async (skip = false) => {
    setSaving(true)
    const result: BrewResult = skip
      ? { ...facts, tastes: [], improve: [], compared: null, yieldG: null, notes: '' }
      : { ...facts, tastes, improve, compared: previous ? compared : null, yieldG: yieldText.trim() === '' ? null : yieldG, notes: notes.trim() }
    const savedChoices = { ...choices, bagId: bag.id }
    try {
      const outcomes = [await saveDraft.mutateAsync({ beanId: bag.bean.id, method: 'v60', choices: savedChoices, lastBrew: result })]
      if (lock && !skip) {
        outcomes.push(
          await lockRecipe.mutateAsync({
            recipeId: ids.recipe,
            versionId: ids.version,
            brewId: ids.brew,
            bagId: bag.id,
            method: 'v60',
            name: 'V60',
            snapshot: {
              choices: savedChoices,
              recipe: { doseG: recipe.doseG, waterG: recipe.waterG, ratio: recipe.ratio, tempC: recipe.tempC, grindUm: recipe.grindUm, targetTimeS: recipe.targetTimeS, pours: recipe.pours },
            },
            result,
            rating,
          }),
        )
        const patch = afterLock(bag)
        if (!isEmpty(patch)) outcomes.push(await updateBag.mutateAsync({ bagId: bag.id, patch }))
      }
      clearSession()
      if (outcomes.includes('queued')) toast.show("Saved on this phone. It will sync when you're back online.")
      void navigate(`/beans/${bag.id}`)
    } catch {
      setSaving(false)
      toast.show("Couldn't save that. Check your connection and try again.")
    }
  }

  return (
    <>
      <BeanHeader
        beanId={bag.bean.id}
        title="How did it go?"
        subtitle={
          <>
            {bag.bean.name}
            {!session.untimed && (
              <>
                {' · '}
                <span className="num">{clock(session.finishedS)}</span> total
              </>
            )}
          </>
        }
      />

      <section aria-label="Taste" className="mt-6">
        <SectionHeading>How did it taste?</SectionHeading>
        <div className="mt-2">
          <MultiChipGroup<Taste> label="Taste" options={TASTES} value={tastes} onToggle={(chip) => setTastes((current) => toggleExclusive(current, chip, 'good'))} />
        </div>
      </section>

      <section aria-label="Improve next time" className="mt-6">
        <SectionHeading>What do you want to improve next time?</SectionHeading>
        <div className="mt-2">
          <MultiChipGroup<Improve> label="Improve next time" options={IMPROVES} value={improve} onToggle={(chip) => setImprove((current) => toggleExclusive(current, chip, 'nothing'))} />
        </div>
      </section>

      {previous && (
        <section aria-label="Compared with last time" className="mt-6">
          <SectionHeading>Compared with last time, was it…</SectionHeading>
          <div className="mt-2">
            <ChipGroup<Compared> label="Compared with last time" options={COMPARED} value={compared} onChange={setCompared} />
          </div>
        </section>
      )}

      <section aria-label="Details" className="mt-6 space-y-3">
        <label className="squircle flex items-center justify-between rounded-3xl bg-soft px-5 py-3">
          <span className="text-sm text-muted">Yield in the cup (g)</span>
          <input
            type="number"
            inputMode="decimal"
            value={yieldText}
            onChange={(event) => setYieldText(event.target.value)}
            aria-invalid={!yieldOk}
            placeholder="Optional"
            className="num w-24 bg-transparent text-right outline-none"
          />
        </label>
        <label className="squircle block rounded-3xl bg-soft px-5 py-3">
          <span className="text-sm text-muted">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Optional"
            className="mt-1 block w-full resize-none bg-transparent outline-none"
          />
        </label>
      </section>

      <section aria-label="Lock this recipe" className="squircle mt-6 rounded-4xl bg-soft px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Lock this as my recipe</span>
            <span className="block text-xs text-muted">Rate it and keep these exact numbers. Friends can see them.</span>
          </span>
          <Switch label="Lock this as my recipe" checked={lock} onChange={setLock} />
        </div>
        {lock && (
          <div className="mt-4">
            <p className="text-xs text-muted">Rating</p>
            <div role="radiogroup" aria-label="Rating" className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
                  onClick={() => setRating(n)}
                  className={`grid size-11 place-items-center rounded-full text-lg ${n <= rating ? 'bg-ink text-bg' : 'bg-bg text-muted'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <Button
        onClick={() => void save()}
        disabled={!canSave}
        className="mt-6"
      >
        {lock ? 'Lock in and save' : 'Save'}
      </Button>
      <Button onClick={() => void save(true)} disabled={saving} variant="quiet" size="md" className="mt-2">
        Skip, I didn't taste it
      </Button>
    </>
  )
}
