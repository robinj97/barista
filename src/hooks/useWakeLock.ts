import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keeps the screen awake while brewing. `request` must be called from a user
 * gesture on iOS. The lock is re-acquired when the tab becomes visible again.
 */
export function useWakeLock() {
  const sentinel = useRef<WakeLockSentinel | null>(null)
  const wanted = useRef(false)
  const [active, setActive] = useState(false)
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  const acquire = useCallback(async () => {
    if (!supported) return
    try {
      const lock = await navigator.wakeLock.request('screen')
      sentinel.current = lock
      setActive(true)
      lock.addEventListener('release', () => setActive(false))
    } catch {
      setActive(false)
    }
  }, [supported])

  const request = useCallback(async () => {
    wanted.current = true
    await acquire()
  }, [acquire])

  const release = useCallback(async () => {
    wanted.current = false
    await sentinel.current?.release()
    sentinel.current = null
    setActive(false)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wanted.current) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel.current?.release()
    }
  }, [acquire])

  return { supported, active, request, release }
}
