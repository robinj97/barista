import { useState } from 'react'

interface AvatarProps {
  name: string
  url?: string | null
  className?: string
}

/** Google avatar when there is one, otherwise a pebble with the first letter. */
export function Avatar({ name, url, className = 'size-10' }: AvatarProps) {
  // Remember which URL failed, so a new URL gets its own chance to load.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  if (url && url !== brokenUrl) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBrokenUrl(url)}
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
