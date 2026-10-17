import { Sheet } from '../components/Sheet'
import { eyebrow } from '../beans/cardText'
import { beanCover } from '../beans/cover'
import type { Bag } from '../data/types'

interface BagPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bags: Bag[]
  selectedId: string | undefined
  onPick: (bag: Bag) => void
}

export function BagPickerSheet({ open, onOpenChange, bags, selectedId, onPick }: BagPickerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Which bean?">
      <ul className="space-y-1 px-2 pb-2">
        {bags.map((bag) => {
          const cover = beanCover(bag.bean.id)
          const line = eyebrow(bag.bean)
          return (
            <li key={bag.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(bag)
                  onOpenChange(false)
                }}
                className={`flex min-h-16 w-full items-center gap-3 rounded-3xl px-3 py-2 text-left ${
                  bag.id === selectedId ? 'bg-accent-soft' : 'active:bg-soft'
                }`}
              >
                <span className={`size-11 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  {line && <span className="block truncate text-xs font-medium text-accent">{line}</span>}
                  <span className="block truncate font-medium">{bag.bean.name}</span>
                  <span className="block truncate text-xs text-muted">{bag.bean.roaster}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
