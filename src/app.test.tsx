import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthState } from './auth/AuthContext'
import { AuthGate } from './auth/AuthGate'
import { routes } from './router'

const signedIn = { user: { email: 'robin@example.com' } } as Session

function auth(session: Session | null, overrides: Partial<AuthState> = {}): AuthState {
  return {
    session,
    loading: false,
    error: null,
    signInWithGoogle: async () => {},
    signOut: async () => {},
    ...overrides,
  }
}

function renderAt(path: string, state: AuthState = auth(signedIn)) {
  render(
    <AuthContext.Provider value={state}>
      <AuthGate>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      </AuthGate>
    </AuthContext.Provider>,
  )
}

describe('app shell', () => {
  it('redirects / to the Beans tab', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Beans' })).toBeInTheDocument()
  })

  it('shows the three primary tabs', () => {
    renderAt('/beans')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toHaveTextContent('Beans')
    expect(nav).toHaveTextContent('Brew')
    expect(nav).toHaveTextContent('Library')
  })

  it('navigates between tabs', async () => {
    renderAt('/beans')
    await userEvent.click(screen.getByRole('link', { name: 'Library' }))
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })

  it('opens a bean page from the list', async () => {
    renderAt('/beans')
    await userEvent.click(screen.getByRole('link', { name: /Elto Arbegona/ }))
    expect(screen.getByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('shows the account and signs out from the Library tab', async () => {
    const signOut = vi.fn(async () => {})
    renderAt('/library', auth(signedIn, { signOut }))
    expect(screen.getByText('robin@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })
})

describe('auth gate', () => {
  it('shows sign-in instead of the app when signed out', async () => {
    const signInWithGoogle = vi.fn(async () => {})
    renderAt('/beans', auth(null, { signInWithGoogle }))
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signInWithGoogle).toHaveBeenCalled()
  })

  it('shows sign-in errors', () => {
    renderAt('/beans', auth(null, { error: 'Unable to sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to sign in')
  })

  it('shows a loading state while the session is restored', () => {
    renderAt('/beans', auth(null, { loading: true }))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
