import { useEffect, useState } from 'react'

interface VisibleViewport {
  /** Height of the part of the screen the person can actually see. */
  height: number
  /** How much of the layout viewport's bottom is covered, usually by the on-screen keyboard. */
  bottomInset: number
}

function measure(): VisibleViewport {
  const viewport = window.visualViewport
  if (!viewport) return { height: window.innerHeight, bottomInset: 0 }
  return {
    height: viewport.height,
    bottomInset: Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
  }
}

/**
 * Tracks the visible part of the screen, so fixed UI can sit above the keyboard
 * instead of behind it. Android Chrome and iOS Safari both overlay the keyboard
 * without shrinking `dvh`, so CSS alone cannot do this.
 */
export function useVisibleViewport(enabled: boolean): VisibleViewport | null {
  const [visible, setVisible] = useState<VisibleViewport | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport) {
      setVisible(null)
      return
    }
    const update = () => setVisible(measure())
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [enabled])

  return visible
}
