import { useState } from 'react'

/**
 * Calls `onOpen` each time a controlled sheet's `open` prop turns true, so it starts fresh.
 * Vaul only reports open changes it makes itself, not ones made through the prop.
 * Runs during render (React's "adjust state when a prop changes" pattern), not in an effect.
 */
export function useOnOpen(open: boolean, onOpen: () => void) {
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) onOpen()
  }
}
