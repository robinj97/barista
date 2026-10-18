import type { ReactNode } from 'react'

interface SpecProps {
  label: string
  value: string
  /** Set by hand rather than suggested: marked with a dot. Only for an editable card. */
  edited?: boolean
  /** Makes the card a button that edits it. */
  onEdit?: () => void
}

/** One labelled number: Coffee 20 g. Read-only, or tap to edit. */
export function Spec({ label, value, edited = false, onEdit }: SpecProps) {
  if (!onEdit) {
    return (
      <div className="squircle rounded-3xl bg-soft px-4 py-3">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="num mt-0.5 text-base">{value}</dd>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${label}: ${value}${edited ? ', set by you' : ''}. Edit`}
      className="squircle relative rounded-3xl bg-soft px-4 py-3 text-left active:scale-[0.97]"
    >
      <span className="block text-xs text-muted">{label}</span>
      <span className="num mt-0.5 block text-base">{value}</span>
      {edited && <span className="absolute top-3 right-3 size-1.5 rounded-full bg-accent" aria-hidden />}
    </button>
  )
}

/** Three cards to a row. */
export function SpecGrid({ label, children, className = 'mt-4' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <dl className={`grid grid-cols-3 gap-2 ${className}`} aria-label={label}>
      {children}
    </dl>
  )
}
