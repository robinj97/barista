import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { micronsToSetting, settingToMicrons } from '../../engine/grinder.ts'
import { suggest } from '../../engine/suggest.ts'
import { LIMITS } from '../../engine/overrides.ts'
import { fromDisplayTemp, toDisplayTemp } from '../../engine/units.ts'
import type { Confidence } from '../../engine/grinder.ts'
import { BeanHeader } from '../beans/BeanHeader'
import { toISODate } from '../beans/dates'
import { buildSuggestInput } from '../brew/buildInput'
import { afterBrew, isEmpty } from '../brew/bagUsage'
import { BrewingPanel } from '../brew/BrewingPanel'
import { primeSound } from '../brew/cues'
import { EditSheet } from '../brew/EditSheet'
import { clearEdits, doseFor, hasEdits, resetEdit, setCups, setDose, setGrind, setPours, setRatio, setTemp, setTime, setWater } from '../brew/edits'
import { GOAL_LABELS, goalOf, parseChoices, toSearchParams, type BrewChoices, type RecipeEdits } from '../brew/params'
import { LastBrewCard } from '../brew/LastBrewCard'
import { BackLink } from '../components/BackLink'
import { Spec, SpecGrid } from '../components/Spec'
import { PourList } from '../brew/PourList'
import { PoursSheet } from '../brew/PoursSheet'
import { recipeText } from '../brew/format'
import { finishSession, readSession, clearSession, startSession, untimedSession, writeSession, type BrewSession } from '../brew/session'
import { useNow, useWakeLock } from '../brew/useBrewClock'
import { useBrewSelection } from '../brew/useBrewSelection'
import { usePriors } from '../brew/usePriors'
import { useMyDrafts, useSaveDraft, useUpdateBag } from '../data/hooks'
import { WhySheet } from '../brew/WhySheet'
import { PourRing } from '../components/PourRing'
import { SegmentedControl } from '../components/SegmentedControl'
import { isCalibrated } from '../../engine/grinder.ts'
import { grinderName } from '../profile/gearLabels'
import { Button } from '../components/Button'
import { LoadingNote } from '../components/LoadingNote'

/** The time of a tap; kept out of the component so it is clearly not read while rendering. */
const clockNow = () => Date.now()

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  low: 'Starting point · expect 2–3 brews',
  medium: 'Informed by similar brews',
  high: 'Based on your own recipe',
}

const doseProblem = (doseG: number): string | null =>
  doseG < LIMITS.doseG[0] || doseG > LIMITS.doseG[1] ? `That needs ${doseG} g of coffee; use ${LIMITS.doseG[0]} to ${LIMITS.doseG[1]} g.` : null

function KeepSwitch<T extends string>({ label, options, value, onChange, note }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; note: string }) {
  return (
    <div className="mt-2 px-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <SegmentedControl label={label} options={options} value={value} onChange={onChange} />
      </div>
      <p className="mt-1 text-right text-xs text-muted">{note}</p>
    </div>
  )
}

type Editing = 'dose' | 'water' | 'ratio' | 'temp' | 'time' | 'grind' | 'pours' | null

/** The suggested recipe for the choices on the set-up screen. Nothing is saved yet. */
export function RecipePage() {
  const [params, setParams] = useSearchParams()
  const choices = parseChoices(params)
  const selection = useBrewSelection(choices)
  const [why, setWhy] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const [keepWater, setKeepWater] = useState(false)
  const [waterKeeps, setWaterKeeps] = useState<'coffee' | 'ratio'>('coffee')
  const [ratioKeeps, setRatioKeeps] = useState<'coffee' | 'water'>('coffee')
  const navigate = useNavigate()
  const saveDraft = useSaveDraft()
  const updateBag = useUpdateBag()
  // A brew in progress survives closing the app: it is kept on the phone.
  const [session, setSession] = useState<BrewSession | null>(readSession)
  const brewing = session !== null && session.finishedS === null && session.bagId === (choices.bagId ?? selection.bag?.id)
  const now = useNow(brewing)
  useWakeLock(brewing)
  const [view, setView] = useState<'recipe' | 'pours'>(brewing ? 'pours' : 'recipe')
  // Each view starts at its top, not wherever the other one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])
  // Fixed when the screen opens, so the recipe does not change under you at midnight.
  const [today] = useState(() => toISODate(new Date()))
  const own = usePriors(today)
  const drafts = useMyDrafts()

  const back = <BackLink to={{ pathname: '/brew', search: params.toString() }} label="Back to set up" />

  if (selection.bags.isPending || own.pending) {
    return (
      <>
        {back}
        <LoadingNote />
      </>
    )
  }

  const { bag } = selection
  if (!bag || selection.bagMissing) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-[2rem] leading-tight font-medium tracking-tight">Bean not found</h1>
        <p className="mt-2 text-sm text-muted">That bag isn't in your beans. Go back and pick another.</p>
      </>
    )
  }

  const unit = selection.profile.data?.temp_unit ?? 'c'
  const out = suggest(buildSuggestInput(bag, choices, selection.filter?.filter ?? null, today, own.context))
  const { recipe } = out
  const text = recipeText(recipe, unit)
  const goal = goalOf(choices.balance)
  const goalText = goal ? GOAL_LABELS[goal].toLowerCase() : 'custom balance'

  const myGrinder = selection.grinder
  const converted = myGrinder && isCalibrated(myGrinder.grinder) ? micronsToSetting(myGrinder.grinder, recipe.grindUm, myGrinder.offsetUm) : null

  const apply = (next: BrewChoices) => setParams(toSearchParams({ ...next, bagId: bag.id }), { replace: true })
  const shown = { ratio: recipe.waterG / recipe.doseG, waterG: recipe.waterG }
  const has = (...keys: (keyof RecipeEdits)[]) => keys.some((key) => key in choices.edits)
  const isOverridden = (key: (typeof out.overridden)[number]) => out.overridden.includes(key)
  const close = () => setEditing(null)
  const nudgeDose = (direction: 1 | -1) => {
    const doseG = Math.min(LIMITS.doseG[1], Math.max(LIMITS.doseG[0], recipe.doseG + direction))
    apply(setDose(choices, doseG, 'ratio', shown))
  }
  const unitLabel = myGrinder?.grinder.unitLabel ?? 'µm'
  const lastBrew = drafts.data?.find((d) => d.beanId === bag.bean.id && d.method === 'v60')?.lastBrew

  const startBrewing = () => {
    // Your working recipe for this bean is overwritten with what you are about to brew.
    // The gear in use is saved with it, so the next brew starts on the same grinder and filter.
    saveDraft.mutate({
      beanId: bag.bean.id,
      method: 'v60',
      choices: { ...choices, bagId: bag.id, grinderId: selection.grinder?.grinder.id ?? null, filterId: selection.filter?.filter.id ?? 'none' },
    })
    setView('pours')
  }
  const startTimer = () => {
    primeSound()
    const next = startSession(bag.id, toSearchParams({ ...choices, bagId: bag.id }).toString(), today, clockNow(), recipe)
    writeSession(next)
    setSession(next)
  }
  /** A brew is over: the coffee is spent, so it comes out of the bag, then on to the log. */
  const completeBrew = (done: BrewSession) => {
    writeSession(done)
    setSession(done)
    const patch = afterBrew(bag, recipe.doseG)
    if (!isEmpty(patch)) updateBag.mutate({ bagId: bag.id, patch })
    void navigate('/brew/log')
  }
  const finish = () => {
    if (session) completeBrew(finishSession(session, clockNow()))
  }
  // For people who brew without the timer.
  const finishUntimed = () =>
    completeBrew(untimedSession(bag.id, toSearchParams({ ...choices, bagId: bag.id }).toString(), today, clockNow()))
  const cancel = () => {
    clearSession()
    setSession(null)
    setView('recipe')
  }

  return (
    <>
      <BeanHeader beanId={bag.bean.id} title={bag.bean.name} subtitle={`V60 · ${goalText}, ${choices.strength}`} back={back} />

      {!brewing && (
        <button
          type="button"
          onClick={() => setWhy(true)}
          className="mx-auto mt-5 flex h-9 items-center rounded-full bg-accent-soft px-4 text-sm text-accent"
        >
          {out.overridden.length > 0 ? 'Your edits · started from a suggestion' : out.confidence.source === 'friend' && out.confidence.who ? `Based on ${out.confidence.who}` : CONFIDENCE_TEXT[out.confidence.level]} ›
        </button>
      )}

      {view === 'recipe' && !brewing && lastBrew && <LastBrewCard brew={lastBrew} unit={unit} grinder={selection.grinder} />}

      {/* The ring is only on the Recipe view: on the Pours view the space is for the pours and the buttons. */}
      {view === 'recipe' && !brewing && (
        <div className="mt-4">
          <PourRing pours={recipe.pours} caption={`${recipe.pours.length} pours`} />
        </div>
      )}


      {!brewing && (
      <div className="mt-4 flex justify-center">
        <SegmentedControl
          label="Recipe view"
          options={[
            { value: 'recipe', label: 'Recipe' },
            { value: 'pours', label: 'Pours' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      )}

      {brewing && session ? (
        <BrewingPanel pours={recipe.pours} session={session} now={now} onFinish={finish} onCancel={cancel} />
      ) : view === 'recipe' ? (
        <>
      <SpecGrid label="Recipe">
        <Spec label="Coffee" value={text.coffee} edited={isOverridden('doseG')} onEdit={() => setEditing('dose')} />
        <Spec label="Water" value={text.water} edited={isOverridden('waterG') || isOverridden('pours')} onEdit={() => setEditing('water')} />
        <Spec label="Ratio" value={text.ratio} edited={isOverridden('ratio')} onEdit={() => setEditing('ratio')} />
        <Spec label="Water temp" value={text.temp} edited={isOverridden('tempC')} onEdit={() => setEditing('temp')} />
        <Spec label="Total time" value={text.time} edited={isOverridden('targetTimeS')} onEdit={() => setEditing('time')} />
        <Spec label="Filter" value={recipe.filter ? recipe.filter.model : 'None'} />
      </SpecGrid>

      <section aria-label="Grind" className="squircle relative mt-3 rounded-4xl bg-soft px-5 py-4 active:scale-[0.99]">
        <button type="button" onClick={() => setEditing('grind')} aria-label="Edit grind" className="absolute inset-0 rounded-4xl" />
        <p className="text-xs text-muted">Grind{myGrinder ? ` · ${grinderName(myGrinder.grinder)}` : ''}</p>
        {isOverridden('grindUm') && <span className="absolute top-4 right-5 size-1.5 rounded-full bg-accent" aria-hidden />}
        {converted && myGrinder ? (
          <>
            <p className="num mt-1 text-2xl">
              {converted.setting} <span className="text-sm text-muted">{myGrinder.grinder.unitLabel}</span>
            </p>
            <p className="mt-1 text-xs text-muted">About {recipe.grindUm} µm</p>
            {converted.confidence === 'low' && (
              <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">Rough estimate</p>
            )}
            {converted.extrapolated && (
              <p className="mt-1 text-xs text-muted">This is outside the range we know for this grinder, so treat it as a guess.</p>
            )}
            {converted.clamped && <p className="mt-1 text-xs text-muted">That is at the limit of this grinder.</p>}
          </>
        ) : (
          <>
            <p className="num mt-1 text-2xl">
              {recipe.grindUm} <span className="text-sm text-muted">µm</span>
            </p>
            {myGrinder ? (
              <p className="mt-1 text-xs text-muted">We can't convert to {grinderName(myGrinder.grinder)} yet, so use the size as a guide.</p>
            ) : (
              <Link to="/profile" className="relative mt-2 inline-block text-sm text-accent underline">
                Add your grinder to see clicks
              </Link>
            )}
          </>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between px-2">
        <span className="text-sm text-muted">Cups</span>
        <SegmentedControl
          label="Cups"
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
          value={isOverridden('doseG') ? '' : String(choices.cups)}
          onChange={(value) => apply(setCups(choices, Number(value), shown))}
        />
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
        <span className="text-sm text-muted">Coffee</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Less coffee" onClick={() => nudgeDose(-1)} className="size-10 rounded-full bg-soft active:scale-95">
            −
          </button>
          <span className="num min-w-[4.5rem] text-center whitespace-nowrap">{recipe.doseG} g</span>
          <button type="button" aria-label="More coffee" onClick={() => nudgeDose(1)} className="size-10 rounded-full bg-soft active:scale-95">
            +
          </button>
        </div>
      </div>

      <Button onClick={startBrewing} className="mt-5">
        Start brewing
      </Button>
        </>
      ) : (
      <section aria-label="Pours" className="mt-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-medium text-muted">Pours{isOverridden('pours') ? ' · yours' : ''}</h2>
          <button type="button" onClick={() => setEditing('pours')} className="h-9 rounded-full px-3 text-sm text-accent">
            Edit pours
          </button>
        </div>
        <PourList pours={recipe.pours} amounts className="mt-2" />
        <p className="mt-2 px-2 text-xs text-muted">Times are a guide, not a clock.</p>
        <div className="mt-4 space-y-3">
          <Button onClick={startTimer} size="xl">
            Start timer
          </Button>
          <Button onClick={finishUntimed} size="xl">
            Finished brewing
          </Button>
        </div>
      </section>
      )}

      {!brewing && view === 'recipe' && (
        <Button onClick={() => setWhy(true)} variant="soft" className="mt-3">
          Why these numbers
        </Button>
      )}

      {hasEdits(choices) && !brewing && view === 'recipe' && (
        <Button onClick={() => apply(clearEdits(choices))} variant="quiet" size="md" className="mt-2">
          Reset all to the suggestion
        </Button>
      )}

      <EditSheet
        open={editing === 'dose'}
        onOpenChange={(open) => !open && close()}
        title="Coffee"
        value={recipe.doseG}
        unit="g"
        step={0.5}
        places={1}
        min={LIMITS.doseG[0]}
        max={LIMITS.doseG[1]}
        onSave={(value) => apply(setDose(choices, value, keepWater ? 'water' : 'ratio', shown))}
        onReset={has('doseG') ? () => apply(resetEdit(choices, 'doseG')) : undefined}
      >
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-sm text-muted">Water</span>
          <SegmentedControl
            label="Water when coffee changes"
            options={[
              { value: 'follow', label: 'Follows ratio' },
              { value: 'keep', label: 'Stays' },
            ]}
            value={keepWater ? 'keep' : 'follow'}
            onChange={(value) => setKeepWater(value === 'keep')}
          />
        </div>
      </EditSheet>
      <EditSheet
        open={editing === 'water'}
        onOpenChange={(open) => !open && close()}
        title="Water"
        value={recipe.waterG}
        unit="g"
        step={10}
        min={LIMITS.waterG[0]}
        max={LIMITS.waterG[1]}
        check={(value) => (waterKeeps === 'ratio' ? doseProblem(doseFor(value, shown.ratio)) : null)}
        onSave={(value) => apply(setWater(choices, value, waterKeeps, shown))}
        onReset={has('waterG', 'ratio', 'pours') ? () => apply(resetEdit(choices, 'waterG', 'ratio', 'pours')) : undefined}
      >
        <KeepSwitch
          label="Keep"
          options={[
            { value: 'coffee', label: 'Coffee' },
            { value: 'ratio', label: 'Ratio' },
          ]}
          value={waterKeeps}
          onChange={setWaterKeeps}
          note={waterKeeps === 'ratio' ? 'The coffee is calculated from the water.' : 'The ratio changes.'}
        />
      </EditSheet>
      <EditSheet
        open={editing === 'ratio'}
        onOpenChange={(open) => !open && close()}
        title="Ratio (1 : …)"
        value={recipe.ratio}
        unit=""
        step={0.5}
        places={1}
        min={LIMITS.ratio[0]}
        max={LIMITS.ratio[1]}
        check={(value) => (ratioKeeps === 'water' ? doseProblem(doseFor(recipe.waterG, value)) : null)}
        onSave={(value) => apply(setRatio(choices, value, recipe.doseG, ratioKeeps, shown))}
        onReset={has('ratio', 'waterG', 'pours') ? () => apply(resetEdit(choices, 'ratio', 'waterG', 'pours')) : undefined}
      >
        <KeepSwitch
          label="Keep"
          options={[
            { value: 'coffee', label: 'Coffee' },
            { value: 'water', label: 'Water' },
          ]}
          value={ratioKeeps}
          onChange={setRatioKeeps}
          note={ratioKeeps === 'water' ? 'The coffee is calculated from the ratio.' : 'The water changes.'}
        />
      </EditSheet>
      <EditSheet
        open={editing === 'temp'}
        onOpenChange={(open) => !open && close()}
        title="Water temp"
        value={toDisplayTemp(recipe.tempC, unit)}
        unit={unit === 'c' ? '°C' : '°F'}
        step={1}
        places={unit === 'c' ? 1 : 0}
        min={Math.ceil(toDisplayTemp(LIMITS.tempC[0], unit))}
        max={Math.floor(toDisplayTemp(LIMITS.tempC[1], unit))}
        onSave={(value) => apply(setTemp(choices, Math.round(fromDisplayTemp(value, unit) * 10) / 10))}
        onReset={has('tempC') ? () => apply(resetEdit(choices, 'tempC')) : undefined}
      />
      <EditSheet
        open={editing === 'time'}
        onOpenChange={(open) => !open && close()}
        title="Total time"
        value={recipe.targetTimeS}
        unit="s"
        step={5}
        min={LIMITS.targetTimeS[0]}
        max={LIMITS.targetTimeS[1]}
        onSave={(value) => apply(setTime(choices, value))}
        onReset={has('targetTimeS') ? () => apply(resetEdit(choices, 'targetTimeS')) : undefined}
      />
      <EditSheet
        open={editing === 'grind'}
        onOpenChange={(open) => !open && close()}
        title="Grind"
        value={converted && myGrinder ? converted.setting : recipe.grindUm}
        unit={unitLabel}
        step={converted && myGrinder ? myGrinder.grinder.step : 10}
        places={converted ? 1 : 0}
        min={converted && myGrinder ? (myGrinder.grinder.min ?? 0) : LIMITS.grindUm[0]}
        max={converted && myGrinder ? (myGrinder.grinder.max ?? 1000) : LIMITS.grindUm[1]}
        onSave={(value) => {
          const microns = converted && myGrinder ? settingToMicrons(myGrinder.grinder, value, myGrinder.offsetUm).microns : value
          apply(setGrind(choices, Math.min(LIMITS.grindUm[1], Math.max(LIMITS.grindUm[0], Math.round(microns)))))
        }}
        onReset={has('grindUm') ? () => apply(resetEdit(choices, 'grindUm')) : undefined}
      />
      <PoursSheet
        open={editing === 'pours'}
        onOpenChange={(open) => !open && close()}
        pours={recipe.pours}
        edited={has('pours')}
        onSave={(pours) => apply(setPours(choices, pours))}
        onReset={() => apply(resetEdit(choices, 'pours'))}
      />

      <WhySheet open={why} onOpenChange={setWhy} basis={out.confidence.basis} reasons={out.reasons} />
    </>
  )
}
