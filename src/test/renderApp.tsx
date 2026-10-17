import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AuthGate } from '../auth/AuthGate'
import { ToastProvider } from '../components/Toast'
import { ApiContext } from '../data/ApiContext'
import type { Bag } from '../data/types'
import { SEED_BEANS, createMockApi, type MockOptions } from '../dev/mockApi'
import { routes } from '../router'

export const signedIn = { user: { id: 'user-1', email: 'robin@example.com', user_metadata: {} } } as unknown as Session

export function auth(session: Session | null, overrides: Partial<AuthState> = {}): AuthState {
  return {
    session,
    loading: false,
    error: null,
    signInWithGoogle: async () => {},
    signOut: async () => {},
    ...overrides,
  }
}

/** A bag of one of the mock catalogue beans, for tests that need an existing inventory. */
export function makeBag(beanId: string, overrides: Partial<Bag> = {}): Bag {
  const bean = SEED_BEANS.find((b) => b.id === beanId)
  if (!bean) throw new Error(`no seed bean ${beanId}`)
  return {
    id: `bag-${beanId}`,
    bean,
    roastDate: null,
    gramsRemaining: 250,
    status: 'new',
    createdAt: '2026-10-10T10:00:00Z',
    ...overrides,
  }
}

interface RenderOptions {
  auth?: AuthState
  mock?: MockOptions
}

/** Renders the whole app at a route against an in-memory API. */
export function renderApp(path = '/beans', options: RenderOptions = {}) {
  const api = createMockApi(options.mock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <AuthContext.Provider value={options.auth ?? auth(signedIn)}>
      <ApiContext.Provider value={api}>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <AuthGate>
              <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
            </AuthGate>
          </ToastProvider>
        </QueryClientProvider>
      </ApiContext.Provider>
    </AuthContext.Provider>,
  )
  return { api, client }
}
