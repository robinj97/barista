import { ringSegments, type RingPour } from './ringSegments'

interface PourRingProps {
  pours: RingPour[]
  /** Index of the pour in progress; earlier pours are shown as done. */
  current: number
}

export function PourRing({ pours, current }: PourRingProps) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const segments = ringSegments(pours, circumference)
  const done = pours[Math.max(0, current)]

  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 180 180" className="size-full" aria-hidden>
        {segments.map((segment, index) => (
          <circle
            key={index}
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            stroke={index <= current ? 'var(--accent)' : 'var(--hairline)'}
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-segment.start}
            transform="rotate(-90 90 90)"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-4xl font-medium">
          {done?.toG ?? 0}
          <span className="text-sm text-muted"> g</span>
        </span>
        <span className="text-xs text-muted">
          pour {Math.min(current + 1, pours.length)} of {pours.length}
        </span>
      </div>
    </div>
  )
}
