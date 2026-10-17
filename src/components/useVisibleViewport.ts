import { useSyncExternalStore } from 'react'

interface VisibleViewport {
  /** Height of the part of the screen the person can actually see. */
  height: number
  /** How much of the layout viewport's bottom is covered, usually by the on-screen keyboard. */
  bottomInset: number
}

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)
  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}

const noSubscription = () => () => {}

function visibleHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight
}

function bottomInset(): number {
  const viewport = window.visualViewport
  if (!viewport) return 0
  return Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
}

/**
 * Tracks the visible part of the screen, so fixed UI can sit above the keyboard
 * instead of behind it. Android Chrome and iOS Safari both overlay the keyboard
 * without shrinking `dvh`, so CSS alone cannot do this.
 */
export function useVisibleViewport(enabled: boolean): VisibleViewport | null {
  const listen = enabled ? subscribe : noSubscription
  const height = useSyncExternalStore(listen, visibleHeight)
  const inset = useSyncExternalStore(listen, bottomInset)
  return enabled && window.visualViewport ? { height, bottomInset: inset } : null
}
