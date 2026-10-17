import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

const icon = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/beans',
    label: 'Beans',
    icon: (
      <svg {...icon}>
        <path d="M12 3c4.5 0 7 3.4 7 7.5S16.5 21 12 21 5 14.6 5 10.5 7.5 3 12 3Z" />
        <path d="M12 3c-2 3-2 6 0 9s2 6 0 9" />
      </svg>
    ),
  },
  {
    to: '/brew',
    label: 'Brew',
    icon: (
      <svg {...icon}>
        <path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Z" />
        <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
        <path d="M9 3v2M12 3v2" />
      </svg>
    ),
  },
  {
    to: '/library',
    label: 'Library',
    icon: (
      <svg {...icon}>
        <path d="M5 4h4v16H5zM11 4h4v16h-4z" />
        <path d="m17 6 3.5 1-3 12.5-3.5-1" />
      </svg>
    ),
  },
]

export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2"
    >
      <ul className="flex gap-1 rounded-full border border-hairline bg-soft/85 p-1.5 backdrop-blur-xl">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              aria-label={tab.label}
              className={({ isActive }) =>
                `flex h-12 w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors duration-200 ${
                  isActive ? 'bg-bg text-accent' : 'text-muted'
                }`
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
