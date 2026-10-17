import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { ToastProvider } from '../components/Toast'
import { ApiContext } from '../data/ApiContext'
import { router } from '../router'
import type { Bag } from '../data/types'
import { SEED_BEANS, createMockApi } from './mockApi'

const session = {
  user: { id: 'user-1', email: 'robin@example.com', user_metadata: { full_name: 'Robin' } },
} as unknown as Session

/**
 * Dev-only preview: open the app with `?mock` to browse the signed-in screens against an
 * in-memory API, without signing in. Not included in production builds.
 */
const SAMPLE_BAGS: Bag[] = [
  { id: 'bag-1', bean: SEED_BEANS[0]!, roastDate: '2026-10-08', gramsRemaining: 142, status: 'locked', createdAt: '2026-10-09T10:00:00Z' },
  { id: 'bag-2', bean: SEED_BEANS[1]!, roastDate: '2026-10-12', gramsRemaining: 220, status: 'dialing_in', createdAt: '2026-10-13T10:00:00Z' },
  { id: 'bag-3', bean: SEED_BEANS[2]!, roastDate: null, gramsRemaining: 250, status: 'new', createdAt: '2026-10-14T10:00:00Z' },
]

export default function MockApp() {
  // ?mock starts with an empty inventory; ?mock=bags starts with three sample bags.
  const withBags = new URLSearchParams(window.location.search).get('mock') === 'bags'
  const [api] = useState(() =>
    createMockApi({
      latencyMs: 120,
      grinderIds: ['turin-df54', 'kingrinder-k7'],
      filterIds: ['f-cafec-t90'],
      bags: withBags ? SAMPLE_BAGS : [],
    }),
  )
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
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </ApiContext.Provider>
    </AuthContext.Provider>
  )
}
