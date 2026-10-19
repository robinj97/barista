import { useEffect, useState, type ReactNode } from 'react'
import { BeanHeader } from '../beans/BeanHeader'
import { clearEdits, hasEdits } from '../brew/edits'
import { BrewingPanel } from '../brew/BrewingPanel'
import { GOAL_LABELS, goalOf } from '../brew/params'
import { LastBrewCard } from '../brew/LastBrewCard'
import { PourRing } from '../components/PourRing'
import { Button } from '../components/Button'
import { SegmentedControl } from '../components/SegmentedControl'
import { SuggestCard } from '../brew/SuggestCard'
import { canSuggest } from '../brew/suggestTweak'
import { useMyDrafts, useMyFeatures, useSaveDraft } from '../data/hooks'
import { WhySheet } from '../brew/WhySheet'
import { ConfidencePill } from './ConfidencePill'
import { RecipeEditSheets, type EditField } from './EditSheets'
import type { RecipeModel } from './model'
import { PoursView } from './PoursView'
import { RecipeView } from './RecipeView'
import { useBrewRun } from './useBrewRun'

type View = 'recipe' | 'pours'

interface RecipeScreenProps {
  model: RecipeModel
  /** The day the recipe is worked out for, fixed when the screen opened. */
  today: string
  back: ReactNode
}

/**
 * The recipe for a bean, in its three states: the numbers, the pour schedule, and a brew in
 * progress. It only owns what is on screen (which view, which sheet is open); the recipe itself
 * is the model, and the brew's timer is `useBrewRun`.
 */
export function RecipeScreen({ model, today, back }: RecipeScreenProps) {
  const { bag, choices, out, recipe, unit, grinder, apply } = model
  const run = useBrewRun(model, today)
  const saveDraft = useSaveDraft()
  const drafts = useMyDrafts()
  const features = useMyFeatures()
  const [view, setView] = useState<View>(run.brewing ? 'pours' : 'recipe')
  const [editing, setEditing] = useState<EditField | null>(null)
  const [why, setWhy] = useState(false)

  // Each view starts at its top, not wherever the other one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  const goal = goalOf(choices.balance)
  const draft = drafts.data?.find((d) => d.beanId === bag.bean.id && d.method === 'v60')
  const lastBrew = draft?.lastBrew
  const offerSuggestion = features.data?.includes('suggest_tweak') === true && canSuggest(draft)

  const startBrewing = () => {
    // Your working recipe for this bean is overwritten with what you are about to brew, with the
    // gear in use, so the next brew starts on the same grinder and filter.
    saveDraft.mutate({
      beanId: bag.bean.id,
      method: 'v60',
      choices: { ...choices, bagId: bag.id, grinderId: grinder?.grinder.id ?? null, filterId: model.filter?.filter.id ?? 'none' },
    })
    setView('pours')
  }

  return (
    <>
      <BeanHeader
        beanId={bag.bean.id}
        title={bag.bean.name}
        subtitle={`V60 · ${goal ? GOAL_LABELS[goal].toLowerCase() : 'custom balance'}, ${choices.strength}`}
        back={back}
      />

      {!run.brewing && <ConfidencePill out={out} onOpen={() => setWhy(true)} />}

      {view === 'recipe' && !run.brewing && lastBrew && (
        <LastBrewCard brew={lastBrew} unit={unit} grinder={grinder}>
          {offerSuggestion && draft && <SuggestCard model={model} draft={draft} />}
        </LastBrewCard>
      )}

      {/* The ring is only on the Recipe view: on the Pours view the space is for the pours and the buttons. */}
      {view === 'recipe' && !run.brewing && (
        <div className="mt-4">
          <PourRing pours={recipe.pours} caption={`${recipe.pours.length} pours`} />
        </div>
      )}

      {!run.brewing && (
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

      {run.brewing && run.session ? (
        <BrewingPanel
          pours={recipe.pours}
          session={run.session}
          now={run.now}
          onFinish={run.finish}
          onCancel={() => {
            run.cancel()
            setView('recipe')
          }}
        />
      ) : view === 'recipe' ? (
        <RecipeView model={model} onEdit={setEditing} onStart={startBrewing} />
      ) : (
        <PoursView model={model} onEditPours={() => setEditing('pours')} onStartTimer={run.startTimer} onFinishUntimed={run.finishUntimed} />
      )}

      {!run.brewing && view === 'recipe' && (
        <>
          <Button onClick={() => setWhy(true)} variant="soft" className="mt-3">
            Why these numbers
          </Button>
          {hasEdits(choices) && (
            <Button onClick={() => apply(clearEdits(choices))} variant="quiet" size="md" className="mt-2">
              Reset all to the suggestion
            </Button>
          )}
        </>
      )}

      <RecipeEditSheets model={model} editing={editing} onClose={() => setEditing(null)} />
      <WhySheet open={why} onOpenChange={setWhy} basis={out.confidence.basis} reasons={out.reasons} />
    </>
  )
}

