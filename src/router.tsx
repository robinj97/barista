import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from './layout/AppShell'
import { BeanPage } from './pages/BeanPage'
import { BeansPage } from './pages/BeansPage'
import { BrewPage } from './pages/BrewPage'
import { LibraryPage } from './pages/LibraryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/beans" replace /> },
      { path: 'beans', element: <BeansPage /> },
      { path: 'beans/:id', element: <BeanPage /> },
      { path: 'brew', element: <BrewPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
