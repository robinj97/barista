import { useState } from 'react'
import { Link } from 'react-router'
import { formatDMY, toISODate } from '../beans/dates'
import { grindText } from '../brew/feedback'
import { recipeSummary } from '../brew/format'
import { toSearchParams } from '../brew/params'
import { Avatar } from '../components/Avatar'
import { useFriendRecipes, useFriends, useMyBags, useMyGrinders, useProfile } from '../data/hooks'
import type { Bag, FriendRecipe } from '../data/types'
import { FriendRecipeSheet } from './FriendRecipeSheet'
import { LoadingNote } from '../components/LoadingNote'

/** Their numbers as the starting edits for your own brew. Their gear and goal choices are theirs; yours are used. */
function startFrom(recipe: FriendRecipe, bag: Bag) {
  const { choices, recipe: numbers } = recipe.snapshot
  return toSearchParams({
    ...choices,
    bagId: bag.id,
    grinderId: null,
    filterId: null,
    edits: { doseG: numbers.doseG, tempC: numbers.tempC, grindUm: numbers.grindUm, pours: numbers.pours, targetTimeS: numbers.targetTimeS },
  }).toString()
}

/** Recipes your friends have locked. Tap one to see it in full, and to brew from it if you have the bean. */
export function FriendRecipes() {
  const [open, setOpen] = useState<FriendRecipe | null>(null)
  const recipes = useFriendRecipes()
  const friends = useFriends()
  const bags = useMyBags()
  const grinders = useMyGrinders()
  const profile = useProfile()

  if (recipes.isPending || bags.isPending) {
    return (
      <LoadingNote />
    )
  }

  const list = recipes.data ?? []
  if (list.length === 0) {
    return (
      <p className="squircle mt-6 rounded-4xl bg-soft px-5 py-4 text-sm text-muted">
        {friends.data?.length === 0 ? (
          <>
            No friends yet. <Link to="/friends" className="text-accent underline">Invite someone</Link> and their locked recipes will show up here.
          </>
        ) : (
          "Nothing yet. When a friend locks a recipe, it will show up here."
        )}
      </p>
    )
  }

  const unit = profile.data?.temp_unit ?? 'c'
  const openBag = open ? bags.data?.find((b) => b.bean.id === open.bean.id) : undefined
  const grinder = grinders.data?.[0]

  return (
    <>
    <ul className="mt-6 space-y-2" aria-label="Friends' recipes">
      {list.map((recipe) => {
        const { recipe: numbers } = recipe.snapshot
        const bag = bags.data?.find((b) => b.bean.id === recipe.bean.id)
        const body = (
          <>
            <Avatar name={recipe.friend.name} url={recipe.friend.avatarUrl} className="size-[3.25rem] shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{recipe.bean.name}</span>
              <span className="block truncate text-xs text-muted">
                {recipe.friend.name} · {formatDMY(toISODate(new Date(recipe.lockedAt)))}
              </span>
              <span className="num mt-0.5 block truncate text-xs text-muted">
                {recipeSummary(numbers, unit, grindText(numbers.grindUm, grinder))}
              </span>
              {!bag && <span className="mt-0.5 block text-xs text-accent">Add this bean to brew it</span>}
            </span>
          </>
        )
        return (
          <li key={recipe.id} className="squircle rounded-4xl bg-soft">
            <button
              type="button"
              onClick={() => setOpen(recipe)}
              aria-label={`${recipe.bean.name} from ${recipe.friend.name}: see the recipe`}
              className="flex w-full items-center gap-4 py-3 pr-4 pl-3 text-left"
            >
              {body}
            </button>
          </li>
        )
      })}
    </ul>
      <FriendRecipeSheet
        recipe={open}
        onClose={() => setOpen(null)}
        unit={unit}
        grinder={grinder}
        brewTo={open && openBag ? `/brew/recipe?${startFrom(open, openBag)}` : null}
      />
    </>
  )
}
