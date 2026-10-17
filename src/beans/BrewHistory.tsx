import { Link } from 'react-router'
import { suggest } from '../../engine/suggest.ts'
import { buildSuggestInput } from '../brew/buildInput'
import { toSearchParams, type BrewChoices } from '../brew/params'
import { useMyDrafts, useMyFilters, useMyRecipes } from '../data/hooks'
import { TASTE_LABELS, type Bag, type RecipeNumbers } from '../data/types'
import { formatDMY, toISODate } from './dates'

const line = (r: Pick<RecipeNumbers, 'doseG' | 'waterG' | 'tempC'>) => `${r.doseG} g · ${r.waterG} g · ${r.tempC}°C`

function Card({ to, title, meta, children }: { to: string; title: string; meta: string; children: string }) {
  return (
    <Link to={to} className="block rounded-3xl px-4 py-3 active:bg-bg">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted">{meta}</span>
      </span>
      <span className="num mt-0.5 block text-sm text-muted">{children}</span>
    </Link>
  )
}

/** Your recipes for this bean: the working one you keep tweaking, and any you have locked in. Tap one to start from it. */
export function BrewHistory({ bag, today }: { bag: Bag; today: string }) {
  const drafts = useMyDrafts()
  const recipes = useMyRecipes()
  const filters = useMyFilters()

  const draft = drafts.data?.find((d) => d.beanId === bag.bean.id && d.method === 'v60')
  const locked = recipes.data?.filter((r) => r.beanId === bag.bean.id) ?? []
  const open = (choices: BrewChoices) => `/brew/recipe?${toSearchParams({ ...choices, bagId: bag.id }).toString()}`

  let working: { to: string; summary: string; meta: string } | null = null
  if (draft) {
    const filter = filters.data?.find((f) => f.filter.id === draft.choices.filterId)?.filter ?? filters.data?.find((f) => f.isDefault)?.filter ?? null
    const { recipe } = suggest(buildSuggestInput(bag, draft.choices, filter, today))
    const brewed = draft.lastBrew
    working = {
      to: open(draft.choices),
      summary: `${line(recipe)}${brewed?.taste ? ` · ${TASTE_LABELS[brewed.taste]}` : ''}`,
      meta: brewed ? `Brewed ${formatDMY(toISODate(new Date(brewed.brewedAt)))}` : 'Not brewed yet',
    }
  }

  if (!working && locked.length === 0) {
    return <p className="squircle mt-2 rounded-4xl bg-soft px-5 py-4 text-sm text-muted">No recipes yet. Start dialing in to get a first one.</p>
  }

  return (
    <div className="squircle mt-2 rounded-4xl bg-soft p-2">
      {working && (
        <Card to={working.to} title="Where you left off" meta={working.meta}>
          {working.summary}
        </Card>
      )}
      {locked.map((recipe) => (
        <Card key={recipe.id} to={open(recipe.snapshot.choices)} title={`Locked · ${'★'.repeat(recipe.rating ?? 0) || recipe.name}`} meta={formatDMY(toISODate(new Date(recipe.lockedAt)))}>
          {line(recipe.snapshot.recipe)}
        </Card>
      ))}
    </div>
  )
}
