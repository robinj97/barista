import { Link, type To } from 'react-router'
import { iconButtonClass } from './iconButtonStyle'

/** The round arrow at the top of a detail screen. */
export function BackLink({ to, label }: { to: To; label: string }) {
  return (
    <Link to={to} aria-label={label} className={`${iconButtonClass({ size: 'lg' })} text-lg`}>
      ←
    </Link>
  )
}
