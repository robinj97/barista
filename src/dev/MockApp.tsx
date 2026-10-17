import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { ApiContext } from '../data/ApiContext'
import { router } from '../router'
import { createMockApi } from './mockApi'

const session = {
  user: { id: 'user-1', email: 'robin@example.com', user_metadata: { full_name: 'Robin' } },
} as unknown as Session

/**
 * Dev-only preview: open the app with `?mock` to browse the signed-in screens against an
 * in-memory API, without signing in. Not included in production builds.
 */
export default function MockApp() {
  const [api] = useState(() => createMockApi({ latencyMs: 120, grinderIds: ['turin-df54', 'kingrinder-k7'] }))
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  const [auth] = useState<AuthState>(() => ({
    session,
    loading: false,
    error: null,
    signInWithGoogle: async () => {},
    signOut: async () => {},
  }))

  return (
    <AuthContext.Provider value={auth}>
      <ApiContext.Provider value={api}>
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ApiContext.Provider>
    </AuthContext.Provider>
  )
}
