import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from './layout/AppShell'
import { BeanPage } from './pages/BeanPage'
import { BeansPage } from './pages/BeansPage'
import { BrewPage } from './pages/BrewPage'
import { FriendsPage } from './pages/FriendsPage'
import { InvitePage } from './pages/InvitePage'
import { LogPage } from './pages/LogPage'
import { LibraryPage } from './pages/LibraryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { RecipePage } from './pages/RecipePage'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/beans" replace /> },
      { path: 'beans', element: <BeansPage /> },
      { path: 'beans/:id', element: <BeanPage /> },
      { path: 'brew', element: <BrewPage /> },
      { path: 'brew/recipe', element: <RecipePage /> },
      { path: 'brew/log', element: <LogPage /> },
      { path: 'friends', element: <FriendsPage /> },
      { path: 'invite/:token', element: <InvitePage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
