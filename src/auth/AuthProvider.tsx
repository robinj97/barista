import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthState } from './AuthContext'

/** OAuth errors come back on the redirect URL, either in the query or the hash. */
function readRedirectError(): string | null {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('error_description') ?? hash.get('error_description')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(readRedirectError)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      error,
      signInWithGoogle: async () => {
        setError(null)
        const { error: failure } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        if (failure) setError(failure.message)
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
