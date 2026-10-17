import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { suggest } from '../../engine/suggest.ts'
import { beanCover } from '../beans/cover'
import { afterLock, isEmpty } from '../brew/bagUsage'
import { buildSuggestInput, clock } from '../brew/buildInput'
import { parseChoices } from '../brew/params'
import { clearSession, readSession } from '../brew/session'
import { useBrewSelection } from '../brew/useBrewSelection'
import { ChipGroup } from '../components/ChipGroup'
import { Switch } from '../components/Switch'
import { useToast } from '../components/toastContext'
import { useLockRecipe, useMyDrafts, useSaveDraft, useUpdateBag } from '../data/hooks'
import { TASTE_LABELS, type BrewResult, type Compared, type Taste } from '../data/types'

const TASTES = (Object.keys(TASTE_LABELS) as Taste[]).map((value) => ({ value, label: TASTE_LABELS[value] }))
const COMPARED: { value: Compared; label: string }[] = [
  { value: 'sweeter', label: 'Sweeter' },
  { value: 'more_acidity', label: 'More acidity' },
  { value: 'same', label: 'About the same' },
]

/** After a brew: how it went. Saves your working recipe; locking it in also keeps it for good. */
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

  const [taste, setTaste] = useState<Taste | null>(null)
  const [compared, setCompared] = useState<Compared | null>(null)
  const [yieldText, setYieldText] = useState('')
  const [notes, setNotes] = useState('')
  const [lock, setLock] = useState(false)
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState(false)

  const back = (
    <Link to="/brew" aria-label="Back to Brew" className="grid size-11 place-items-center rounded-full bg-soft text-lg">
      ←
    </Link>
  )

  if (!session || session.finishedS === null) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-[2rem] leading-tight font-medium tracking-tight">Nothing to log</h1>
        <p className="mt-2 text-sm text-muted">Finish a brew and it will show up here.</p>
      </>
    )
  }
  if (selection.bags.isPending || drafts.isPending) {
    return (
      <>
        {back}
        <p role="status" className="mt-10 text-center text-sm text-muted">
          Loading…
        </p>
      </>
    )
  }
  const { bag } = selection
  if (!bag) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-[2rem] leading-tight font-medium tracking-tight">Bean not found</h1>
        <p className="mt-2 text-sm text-muted">That bag isn't in your beans any more.</p>
      </>
    )
  }

  const { recipe } = suggest(buildSuggestInput(bag, choices, selection.filter?.filter ?? null, session.asOf))
  const cover = beanCover(bag.bean.id)
  const previous = drafts.data?.find((d) => d.beanId === bag.bean.id && d.method === 'v60')?.lastBrew ?? null
  const yieldG = Number(yieldText)
  const yieldOk = yieldText.trim() === '' || (Number.isFinite(yieldG) && yieldG > 0)
  const canSave = !saving && yieldOk && (!lock || rating > 0)

  const save = async () => {
    setSaving(true)
    const result: BrewResult = {
      brewedAt: new Date(session.startedAt).toISOString(),
      totalTimeS: session.finishedS!,
      taste,
      compared: previous ? compared : null,
      yieldG: yieldText.trim() === '' ? null : yieldG,
      notes: notes.trim(),
      firstPourG: recipe.pours[0]?.toG ?? 0,
    }
    const savedChoices = { ...choices, bagId: bag.id }
    try {
      const outcomes = [await saveDraft.mutateAsync({ beanId: bag.bean.id, method: 'v60', choices: savedChoices, lastBrew: result })]
      if (lock) {
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
      <div className="flex items-center gap-3">
        {back}
        <span className={`size-12 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-medium">How did it go?</h1>
          <p className="truncate text-xs text-muted">
            {bag.bean.name} · <span className="num">{clock(session.finishedS)}</span> total
          </p>
        </div>
      </div>

      <section aria-label="Taste" className="mt-6">
        <h2 className="px-2 text-xs font-medium text-muted">How did it taste?</h2>
        <div className="mt-2">
          <ChipGroup<Taste> label="Taste" options={TASTES} value={taste} onChange={setTaste} />
        </div>
      </section>

      {previous && (
        <section aria-label="Compared with last time" className="mt-6">
          <h2 className="px-2 text-xs font-medium text-muted">Compared with last time, was it…</h2>
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
            <span className="block text-xs text-muted">Keeps these exact numbers, and friends can see them.</span>
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

      <button
        type="button"
        onClick={() => void save()}
        disabled={!canSave}
        className="mt-6 h-12 w-full rounded-full bg-ink font-medium text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {lock ? 'Lock in and save' : 'Save'}
      </button>
    </>
  )
}
