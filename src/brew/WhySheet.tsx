import { Sheet } from '../components/Sheet'
import type { Reason, ReasonSource } from '../../engine/types.ts'

const SOURCE_LABELS: Record<ReasonSource, string> = {
  method: 'From the 4:6 method',
  guidance: 'General guidance',
  data: 'From your recipes',
  assumption: 'Assumed',
  you: 'You set this',
}

interface WhySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  basis: string
  reasons: Reason[]
}

/** Every decision in the recipe, in plain words, with where it came from. */
export function WhySheet({ open, onOpenChange, basis, reasons }: WhySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Why these numbers">
      <div className="space-y-3 px-3 pb-2">
        <p className="rounded-3xl bg-accent-soft px-4 py-3 text-sm text-accent">{basis}</p>
        <ul className="space-y-3">
          {reasons.map((reason, index) => (
            <li key={index} className="px-2">
              <p className="text-sm font-medium">{reason.what}</p>
              <p className="mt-0.5 text-sm text-muted">{reason.why}</p>
              <p className="mt-1 text-xs text-muted">{SOURCE_LABELS[reason.source]}</p>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
