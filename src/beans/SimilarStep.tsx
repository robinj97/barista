import type { BeanMatch, NewBean, SimilarBean } from '../data/types'
import { beanCover } from './cover'

interface SimilarStepProps {
  entered: NewBean
  similar: SimilarBean[]
  onBack: () => void
  onUseExisting: (bean: BeanMatch) => void
  onDifferent: () => void
}

/** Before a new bean is created: coffees that look a lot like it, so the catalogue keeps one entry per coffee. */
export function SimilarStep({ entered, similar, onBack, onUseExisting, onDifferent }: SimilarStepProps) {
  return (
    <div className="space-y-4 px-3 pb-2">
      <button type="button" onClick={onBack} className="h-9 rounded-full bg-soft px-4 text-sm">
        ← Back
      </button>
      <p className="px-1 text-sm text-muted">
        You entered <span className="text-ink">{entered.roaster} · {entered.name}</span>. These are already in the catalogue. If it's the same coffee, use it:
        you'll see friends' recipes for it, and everyone's beans stay in one place.
      </p>
      <ul className="space-y-1">
        {similar.map(({ bean }) => {
          const cover = beanCover(bean.id)
          const details = [bean.origin, bean.process].filter(Boolean).join(' · ')
          return (
            <li key={bean.id} className="squircle flex items-center gap-3 rounded-3xl bg-soft px-3 py-2">
              <span className={`size-9 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{bean.name}</span>
                <span className="block truncate text-xs text-muted">{[bean.roaster, details].filter(Boolean).join(' · ')}</span>
                {bean.owned && <span className="block text-xs text-muted">In your beans</span>}
                {bean.friendsWithRecipe > 0 && (
                  <span className="block text-xs text-accent">
                    {bean.friendsWithRecipe === 1 ? 'A friend has this dialed in' : `${bean.friendsWithRecipe} friends have this dialed in`}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => onUseExisting(bean)} className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-bg">
                Use this one
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onDifferent} className="h-12 w-full rounded-full bg-soft">
        It's a different bean
      </button>
    </div>
  )
}
