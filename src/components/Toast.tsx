import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContext'

/** One short message at a time, near the top, gone after a few seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: string) => {
    setMessage(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 4500)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-center text-sm text-bg"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
