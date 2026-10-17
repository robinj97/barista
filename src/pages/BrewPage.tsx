import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { eyebrow } from '../beans/cardText'
import { beanCover } from '../beans/cover'
import { BagPickerSheet } from '../brew/BagPickerSheet'
import { GearCard } from '../brew/GearCard'
import { GOAL_BALANCE, GOAL_LABELS, STRENGTHS, goalOf, parseChoices, toSearchParams, type BrewChoices, type Goal } from '../brew/params'
import { useBrewSelection } from '../brew/useBrewSelection'
import { ChipGroup } from '../components/ChipGroup'
import { METHOD_LABELS } from '../data/types'
import { PageHeader } from '../layout/PageHeader'

const GOALS = (Object.keys(GOAL_LABELS) as Goal[]).map((value) => ({ value, label: GOAL_LABELS[value] }))

const label = 'px-2 text-xs font-medium text-muted'

function balanceLabel(balance: number): string {
  if (balance === 0) return 'Balanced'
  return `${Math.round(Math.abs(balance) * 100)}% ${balance < 0 ? 'sweeter' : 'more acidity'}`
}

/** Set up the cup: bean, goal and gear. The recipe is on the next screen. */
export function BrewPage() {
  const [params, setParams] = useSearchParams()
  const choices = parseChoices(params)
  const selection = useBrewSelection(choices)
  const [picking, setPicking] = useState(false)
  const { bag, bags } = selection

  const update = (patch: Partial<BrewChoices>) =>
    setParams(toSearchParams({ ...choices, ...patch }), { replace: true })

  if (bags.isPending) {
    return (
      <>
        <PageHeader title="Brew" />
        <p role="status" className="mt-10 text-center text-sm text-muted">
          Loading…
        </p>
      </>
    )
  }

  if (bags.isError) {
    return (
      <>
        <PageHeader title="Brew" />
        <p role="alert" className="mt-10 text-center text-sm text-accent">
          Couldn't load your beans.{' '}
          <button type="button" onClick={() => void bags.refetch()} className="underline">
            Try again
          </button>
        </p>
      </>
    )
  }

  if (!bag) {
    return (
      <>
        <PageHeader title="Brew" />
        <section aria-label="No beans yet" className="mt-16 flex flex-col items-center text-center">
          <h2 className="text-xl font-medium">Add a bean first</h2>
          <p className="mt-2 max-w-64 text-sm text-balance text-muted">
            Pick a bean from your inventory to get a starting recipe.
          </p>
          <Link to="/beans" className="mt-6 grid h-12 place-items-center rounded-full bg-ink px-8 font-medium text-bg">
            Go to Beans
          </Link>
        </section>
      </>
    )
  }

  const cover = beanCover(bag.bean.id)
  const line = eyebrow(bag.bean)
  const defaultMethod = selection.profile.data?.default_method
  const goal = goalOf(choices.balance)

  const recipeSearch = toSearchParams({ ...choices, bagId: bag.id }).toString()

  return (
    <>
      <PageHeader title="Brew" subtitle="Set up the cup and get a starting recipe." />

      <section aria-label="Bean" className="mt-6">
        <h2 className={label}>Which bean?</h2>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="squircle mt-2 flex w-full items-center gap-4 rounded-4xl bg-soft py-3 pr-5 pl-3 text-left transition-transform active:scale-[0.98]"
        >
          <span className={`size-[3.25rem] shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
          <span className="min-w-0 flex-1">
            {line && <span className="block truncate text-xs font-medium text-accent">{line}</span>}
            <span className="block truncate font-medium">{bag.bean.name}</span>
            <span className="block truncate text-xs text-muted">{bag.bean.roaster}</span>
          </span>
          <span className="text-sm text-muted">Change</span>
        </button>
      </section>

      <section aria-label="Method" className="mt-6">
        <h2 className={label}>Method</h2>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Brew method">
          <button type="button" aria-pressed className="h-10 rounded-full bg-ink px-4 text-sm text-bg">
            {METHOD_LABELS.v60}
          </button>
          {(['aeropress', 'espresso'] as const).map((method) => (
            <button key={method} type="button" disabled className="h-10 rounded-full bg-soft px-4 text-sm text-muted opacity-60">
              {METHOD_LABELS[method]} · soon
            </button>
          ))}
        </div>
        {defaultMethod && defaultMethod !== 'v60' && (
          <p className="mt-2 px-2 text-xs text-muted">
            Your default method ({METHOD_LABELS[defaultMethod]}) isn't available yet, so we're using V60.
          </p>
        )}
      </section>

      <section aria-label="Goal" className="mt-6">
        <h2 className={label}>What do you want from this cup?</h2>
        <div className="mt-2 space-y-2">
          <ChipGroup<Goal>
            label="Sweeter or more acidity"
            options={GOALS}
            value={goal}
            clearable={false}
            onChange={(next) => next && update({ balance: GOAL_BALANCE[next] })}
          />
          <ChipGroup
            label="Strength"
            options={STRENGTHS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
            value={choices.strength}
            clearable={false}
            onChange={(next) => next && update({ strength: next })}
          />
        </div>
        <details className="squircle mt-3 rounded-4xl bg-soft px-5 py-2">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between text-sm text-muted">
            <span>Fine-tune</span>
            <span className="text-xs">{balanceLabel(choices.balance)}</span>
          </summary>
          <div className="pt-2 pb-3">
            <input
              type="range"
              aria-label="Fine-tune balance"
              min={-1}
              max={1}
              step={0.1}
              value={choices.balance}
              onChange={(event) => update({ balance: Number(event.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
            <span className="flex justify-between text-xs text-muted">
              <span>Sweeter</span>
              <span>More acidity</span>
            </span>
          </div>
        </details>
      </section>

      <GearCard
        grinders={selection.myGrinders}
        grinder={selection.grinder}
        filters={selection.myFilters}
        filter={selection.filter}
        onGrinder={(grinderId) => update({ grinderId })}
        onFilter={(filterId) => update({ filterId })}
      />

      <Link
        to={{ pathname: '/brew/recipe', search: recipeSearch }}
        className="mt-8 grid h-12 place-items-center rounded-full bg-ink font-medium text-bg transition-transform active:scale-[0.98]"
      >
        Suggest a recipe
      </Link>

      <BagPickerSheet
        open={picking}
        onOpenChange={setPicking}
        bags={bags.data ?? []}
        selectedId={bag.id}
        onPick={(next) => update({ bagId: next.id })}
      />
    </>
  )
}
