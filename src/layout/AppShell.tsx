import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { takeDestination } from '../auth/afterSignIn'
import { useLogPending } from '../brew/useLogPending'
import { useFlushOutbox } from '../data/hooks'
import { TabBar } from './TabBar'

export function AppShell() {
  useFlushOutbox()
  const logPending = useLogPending()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Back from signing in: carry on to where you were going, like an invite link.
  useEffect(() => {
    const to = takeDestination()
    if (to) void navigate(to, { replace: true })
  }, [navigate])

  // A finished brew has to be logged before anything else: wherever you go, you land back on the log.
  if (logPending && pathname !== '/brew/log') return <Navigate to="/brew/log" replace />

  return (
    <div className="mx-auto min-h-dvh max-w-xl pt-[env(safe-area-inset-top)] pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <main className="px-5 pt-8">
        <Outlet />
      </main>
      {!logPending && <TabBar />}
    </div>
  )
}
