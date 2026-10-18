import { useState } from 'react'
import { Link } from 'react-router'
import { beanCover } from '../beans/cover'
import { toSearchParams } from '../brew/params'
import { FriendRecipes } from '../library/FriendRecipes'
import { SegmentedControl } from '../components/SegmentedControl'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { useArchiveRecipe, useMyBags, useMyRecipes } from '../data/hooks'
import type { LockedRecipe } from '../data/types'
import { PageHeader } from '../layout/PageHeader'

const stars = (rating: number | null) => (rating ? '★'.repeat(rating) : null)

/** The recipes you have locked in, across all beans, kept even when the bag is gone. */
export function LibraryPage() {
  const recipes = useMyRecipes()
  const bags = useMyBags()
  const archive = useArchiveRecipe()
  const toast = useToast()
  const [archiving, setArchiving] = useState<LockedRecipe | null>(null)
  const [tab, setTab] = useState<'mine' | 'friends'>('mine')

  const header = (
    <>
      <PageHeader title="Library" subtitle={tab === 'mine' ? "The recipes you've locked in." : "Recipes your friends have locked in."} />
      <div className="mt-4 flex justify-center">
        <SegmentedControl
          label="Whose recipes"
          options={[
            { value: 'mine', label: 'Mine' },
            { value: 'friends', label: 'Friends' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
    </>
  )

  if (tab === 'friends') {
    return (
      <>
        {header}
        <FriendRecipes />
      </>
    )
  }

  if (recipes.isPending || bags.isPending) {
    return (
      <>
        {header}
        <p role="status" className="mt-10 text-center text-sm text-muted">
          Loading…
        </p>
      </>
    )
  }

  const list = [...(recipes.data ?? [])].sort((a, b) => b.lockedAt.localeCompare(a.lockedAt))

  if (list.length === 0) {
    return (
      <>
        {header}
        <p className="squircle mt-6 rounded-4xl bg-soft px-5 py-4 text-sm text-muted">
          Nothing here yet. After a brew you like, switch on "Lock this as my recipe" and it will be kept here.
        </p>
      </>
    )
  }

  return (
    <>
      {header}
      <ul className="mt-6 space-y-2" aria-label="Your recipes">
        {list.map((recipe) => {
          const { bean } = recipe
          const bag = bags.data?.find((b) => b.bean.id === bean.id)
          const cover = beanCover(bean.id)
          const { recipe: numbers } = recipe.snapshot
          const rating = stars(recipe.rating)
          const to = bag ? `/brew/recipe?${toSearchParams({ ...recipe.snapshot.choices, bagId: bag.id }).toString()}` : null
          const body = (
            <>
              <span className={`size-[3.25rem] shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{bean.name}</span>
                <span className="block truncate text-xs text-muted">
                  {rating && <span className="text-accent">{rating} · </span>}
                  {recipe.brewCount} {recipe.brewCount === 1 ? 'brew' : 'brews'}
                </span>
                <span className="num mt-0.5 block truncate text-xs text-muted">
                  {numbers.doseG} g · {numbers.waterG} g · {numbers.tempC}°C
                </span>
              </span>
            </>
          )
          return (
            <li key={recipe.id} className="squircle flex items-center gap-1 rounded-4xl bg-soft py-3 pr-3 pl-3">
              {to ? (
                <Link to={to} aria-label={`Brew ${bean.name} again`} className="flex min-w-0 flex-1 items-center gap-4">
                  {body}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-4">{body}</div>
              )}
              <button type="button" onClick={() => setArchiving(recipe)} aria-label={`Archive the recipe for ${bean.name}`} className="h-10 rounded-full px-3 text-sm text-muted">
                Archive
              </button>
            </li>
          )
        })}
      </ul>

      <Sheet open={archiving !== null} onOpenChange={(open) => !open && setArchiving(null)} title="Archive this recipe?">
        <div className="px-3 pb-3">
          <p className="px-1 text-sm text-muted">
            Friends will no longer see it and it leaves your lists. Your brews are kept, and you can lock a new recipe for this bean any time.
          </p>
          <button
            type="button"
            onClick={() => {
              const target = archiving
              setArchiving(null)
              if (target) archive.mutate(target.id, { onError: () => toast.show("Couldn't archive that. Check your connection and try again.") })
            }}
            className="mt-4 h-12 w-full rounded-full bg-ink font-medium text-bg"
          >
            Archive
          </button>
          <button type="button" onClick={() => setArchiving(null)} className="mt-2 h-11 w-full rounded-full text-sm text-muted">
            Keep it
          </button>
        </div>
      </Sheet>
    </>
  )
}
