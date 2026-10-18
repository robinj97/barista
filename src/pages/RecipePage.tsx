import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { suggest } from '../../engine/suggest.ts'
import { toISODate } from '../beans/dates'
import { buildSuggestInput } from '../brew/buildInput'
import { parseChoices, toSearchParams, type BrewChoices } from '../brew/params'
import { useBrewSelection } from '../brew/useBrewSelection'
import { usePriors } from '../brew/usePriors'
import { BackLink } from '../components/BackLink'
import { LoadingNote } from '../components/LoadingNote'
import { buildRecipeModel } from '../recipe/model'
import { RecipeScreen } from '../recipe/RecipeScreen'

/**
 * The suggested recipe for the choices on the set-up screen. This page loads what the recipe needs
 * and works it out; `RecipeScreen` shows it. Nothing is saved until you start brewing.
 */
export function RecipePage() {
  const [params, setParams] = useSearchParams()
  const choices = parseChoices(params)
  const selection = useBrewSelection(choices)
  // Fixed when the screen opens, so the recipe does not change under you at midnight.
  const [today] = useState(() => toISODate(new Date()))
  const priors = usePriors(today)

  const back = <BackLink to={{ pathname: '/brew', search: params.toString() }} label="Back to set up" />

  if (selection.bags.isPending || priors.pending) {
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

  const model = buildRecipeModel({
    bag,
    choices,
    out: suggest(buildSuggestInput(bag, choices, selection.filter?.filter ?? null, today, priors.context)),
    unit: selection.profile.data?.temp_unit ?? 'c',
    grinder: selection.grinder,
    filter: selection.filter,
    apply: (next: BrewChoices) => setParams(toSearchParams({ ...next, bagId: bag.id }), { replace: true }),
  })

  return <RecipeScreen model={model} today={today} back={back} />
}
