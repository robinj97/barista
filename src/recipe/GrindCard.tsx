import { Link } from 'react-router'
import { grinderName } from '../profile/gearLabels'
import type { RecipeModel } from './model'

/** The grind in your grinder's own units (or microns), with how far to trust it. Tap to edit. */
export function GrindCard({ model, onEdit }: { model: RecipeModel; onEdit: () => void }) {
  const { grinder, converted, recipe, isOverridden } = model
  return (
    <section aria-label="Grind" className="squircle relative mt-3 rounded-4xl bg-soft px-5 py-4 active:scale-[0.99]">
      <button type="button" onClick={onEdit} aria-label="Edit grind" className="absolute inset-0 rounded-4xl" />
      <p className="text-xs text-muted">Grind{grinder ? ` · ${grinderName(grinder.grinder)}` : ''}</p>
      {isOverridden('grindUm') && <span className="absolute top-4 right-5 size-1.5 rounded-full bg-accent" aria-hidden />}
      {converted && grinder ? (
        <>
          <p className="num mt-1 text-2xl">
            {converted.setting} <span className="text-sm text-muted">{grinder.grinder.unitLabel}</span>
          </p>
          <p className="mt-1 text-xs text-muted">About {recipe.grindUm} µm</p>
          {converted.confidence === 'low' && <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">Rough estimate</p>}
          {converted.extrapolated && <p className="mt-1 text-xs text-muted">This is outside the range we know for this grinder, so treat it as a guess.</p>}
          {converted.clamped && <p className="mt-1 text-xs text-muted">That is at the limit of this grinder.</p>}
        </>
      ) : (
        <>
          <p className="num mt-1 text-2xl">
            {recipe.grindUm} <span className="text-sm text-muted">µm</span>
          </p>
          {grinder ? (
            <p className="mt-1 text-xs text-muted">We can't convert to {grinderName(grinder.grinder)} yet, so use the size as a guide.</p>
          ) : (
            <Link to="/profile" className="relative mt-2 inline-block text-sm text-accent underline">
              Add your grinder to see clicks
            </Link>
          )}
        </>
      )}
    </section>
  )
}
