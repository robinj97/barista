import type { ReactNode } from 'react'
import { SignInPage } from '../pages/SignInPage'
import { useAuth } from './AuthContext'

/** Shows the app only to signed-in users. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
        <span className="pebble-1 size-12 animate-pulse bg-tint-sand" />
      </div>
    )
  }
  if (!session) return <SignInPage />
  return children
}
