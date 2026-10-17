import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { AuthGate } from './auth/AuthGate'
import { AuthProvider } from './auth/AuthProvider'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
)
