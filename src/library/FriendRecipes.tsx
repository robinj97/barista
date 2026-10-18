import { Link } from 'react-router'
import { formatTemp } from '../../engine/units.ts'
import { formatDMY, toISODate } from '../beans/dates'
import { grindText } from '../brew/feedback'
import { toSearchParams } from '../brew/params'
import { Avatar } from '../components/Avatar'
import { useFriendRecipes, useFriends, useMyBags, useMyGrinders, useProfile } from '../data/hooks'
import type { Bag, FriendRecipe } from '../data/types'

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

/** Recipes your friends have locked. Tap one for a bean you have to brew from their numbers. */
export function FriendRecipes() {
  const recipes = useFriendRecipes()
  const friends = useFriends()
  const bags = useMyBags()
  const grinders = useMyGrinders()
  const profile = useProfile()

  if (recipes.isPending || bags.isPending) {
    return (
      <p role="status" className="mt-10 text-center text-sm text-muted">
        Loading…
      </p>
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
  const grinder = grinders.data?.[0]

  return (
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
                {numbers.doseG} g · {numbers.waterG} g · {formatTemp(numbers.tempC, unit)} · {grindText(numbers.grindUm, grinder)}
              </span>
              {!bag && <span className="mt-0.5 block text-xs text-accent">Add this bean to brew it</span>}
            </span>
          </>
        )
        return (
          <li key={recipe.id} className="squircle rounded-4xl bg-soft py-3 pr-4 pl-3">
            {bag ? (
              <Link to={`/brew/recipe?${startFrom(recipe, bag)}`} aria-label={`Brew ${recipe.bean.name} from ${recipe.friend.name}'s recipe`} className="flex items-center gap-4">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-4">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
