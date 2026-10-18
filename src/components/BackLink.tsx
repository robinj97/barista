import { Link, type To } from 'react-router'

/** The round arrow at the top of a detail screen. */
export function BackLink({ to, label }: { to: To; label: string }) {
  return (
    <Link to={to} aria-label={label} className="grid size-11 place-items-center rounded-full bg-soft text-lg">
      ←
    </Link>
  )
}
