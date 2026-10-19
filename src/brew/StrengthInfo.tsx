import { laterPoursFor } from '../../engine/pours.ts'
import type { Strength } from '../../engine/types.ts'
import { InfoButton } from '../components/InfoButton'

/** The first two pours (the 40%) are the same at every strength. */
const FIRST_POURS = 2

const ROWS: { strength: Strength; label: string; line: string }[] = [
  { strength: 'light', label: 'Light', line: 'A gentler, lighter-bodied cup.' },
  { strength: 'medium', label: 'Medium', line: 'A balanced starting point.' },
  { strength: 'strong', label: 'Strong', line: 'More, smaller pours tend to give a stronger, fuller cup.' },
]

/** What the Light / Medium / Strong choice changes. Counts come from the engine, so they cannot drift. */
export function StrengthInfo() {
  return (
    <InfoButton label="About strength" title="Strength">
      <p className="px-1 text-sm text-muted">
        Strength is the number of pours. Following the 4:6 method, the first 40% of the water goes in two pours (that part is your sweet-or-acidity choice), and the last 60% is split into equal pours. More pours, stronger cup. The ratio stays 1:15 at every strength.
      </p>
      <ul className="mt-3 space-y-2">
        {ROWS.map(({ strength, label, line }) => {
          const later = laterPoursFor(strength)
          return (
            <li key={strength} className="squircle rounded-3xl bg-soft px-4 py-3">
              <span className="flex items-baseline justify-between">
                <span className="font-medium">{label}</span>
                <span className="num text-xs text-muted">{FIRST_POURS + later} pours in all</span>
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                The last 60% in {later} pours. {line}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 px-1 text-xs text-muted">
        That is the method's guidance, not something we've measured. Grind size and the ratio also change how strong the cup tastes, and you can edit any pour on the recipe screen.
      </p>
    </InfoButton>
  )
}
