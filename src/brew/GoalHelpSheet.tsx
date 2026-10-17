import { Sheet } from '../components/Sheet'

interface GoalHelpSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Plain taste language for the sweeter / acidity goal, and what "sour" is (not the same thing). */
export function GoalHelpSheet({ open, onOpenChange }: GoalHelpSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sweeter or more acidity?">
      <div className="space-y-4 px-5 pb-3 text-sm">
        <div>
          <p className="font-medium">Sweeter</p>
          <p className="mt-0.5 text-muted">Rounder and more sugar-like, a little like caramel or ripe fruit. The first pour is smaller.</p>
        </div>
        <div>
          <p className="font-medium">Balanced</p>
          <p className="mt-0.5 text-muted">A bit of both. A good place to start.</p>
        </div>
        <div>
          <p className="font-medium">More acidity</p>
          <p className="mt-0.5 text-muted">
            Livelier and juicier, with a fruity tang like orange juice. Coffee people also call this “bright”. The first pour is
            bigger.
          </p>
        </div>
        <div className="rounded-3xl bg-accent-soft px-4 py-3 text-accent">
          <p className="font-medium">Acidity is not sour</p>
          <p className="mt-0.5">
            Sour is sharp and puckering, like a squeezed lime, and usually means the coffee came out under-extracted. That's
            not what this setting is for. If a cup tastes sour, tell us after you brew and we'll help fix it.
          </p>
        </div>
        <p className="text-muted">
          How much the first pour changes the taste varies from coffee to coffee. Treat this as a starting point, and tell us
          how it went.
        </p>
      </div>
    </Sheet>
  )
}
