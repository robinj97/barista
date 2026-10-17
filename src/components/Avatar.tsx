import { useState } from 'react'

interface AvatarProps {
  name: string
  url?: string | null
  className?: string
}

/** Google avatar when there is one, otherwise a pebble with the first letter. */
export function Avatar({ name, url, className = 'size-10' }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${className} pebble-2 grid shrink-0 place-items-center bg-accent-soft font-medium text-accent`}
    >
      {initial}
    </span>
  )
}
