import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { ToastProvider } from '../components/Toast'
import { ApiContext } from '../data/ApiContext'
import { router } from '../router'
import { DEFAULT_CHOICES } from '../brew/params'
import type { Bag, Draft, LockedRecipe } from '../data/types'
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

const SAMPLE_RECIPES: LockedRecipe[] = [
  {
    id: 'recipe-1',
    beanId: SEED_BEANS[0]!.id,
    method: 'v60',
    name: 'V60',
    versionId: 'version-1',
    snapshot: {
      choices: { ...DEFAULT_CHOICES, bagId: 'bag-1' },
      recipe: { doseG: 20, waterG: 300, ratio: 15, tempC: 94, grindUm: 780, targetTimeS: 190, pours: [{ atS: 0, toG: 60 }, { atS: 45, toG: 120 }, { atS: 85, toG: 180 }, { atS: 125, toG: 240 }, { atS: 155, toG: 300 }] },
    },
    rating: 5,
    lockedAt: '2026-10-15T08:00:00Z',
    brewCount: 4,
  },
]

const SAMPLE_DRAFTS: Draft[] = [
  {
    beanId: SEED_BEANS[0]!.id,
    method: 'v60',
    choices: { ...DEFAULT_CHOICES, bagId: 'bag-1' },
    lastBrew: {
      brewedAt: '2026-10-16T08:00:00Z',
      totalTimeS: 172,
      tastes: ['sour', 'weak'],
      improve: ['sweetness', 'body'],
      compared: null,
      yieldG: null,
      notes: 'Finished fast, hard to taste the florals',
      firstPourG: 60,
      recipe: { doseG: 20, waterG: 300, ratio: 15, tempC: 94, grindUm: 780, targetTimeS: 190, pours: [{ atS: 0, toG: 60 }] },
      changes: [
        { param: 'temp', from: 96, to: 94 },
        { param: 'grind', from: 800, to: 780 },
      ],
    },
    updatedAt: '2026-10-16T08:00:00Z',
  },
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
      recipes: withBags ? SAMPLE_RECIPES : [],
      drafts: withBags ? SAMPLE_DRAFTS : [],
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
