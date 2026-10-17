import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { AuthGate } from './auth/AuthGate'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/Toast'
import { ApiContext } from './data/ApiContext'
import { supabaseApi } from './data/supabaseApi'
import { supabase } from './lib/supabase'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

// Cached data belongs to whoever was signed in; drop it so the next account starts clean.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') queryClient.clear()
})

const root = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock')) {
  void import('./dev/MockApp').then(({ default: MockApp }) => {
    root.render(
      <StrictMode>
        <MockApp />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <AuthProvider>
        <AuthGate>
          <ApiContext.Provider value={supabaseApi}>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <RouterProvider router={router} />
              </ToastProvider>
            </QueryClientProvider>
          </ApiContext.Provider>
        </AuthGate>
      </AuthProvider>
    </StrictMode>,
  )
}
