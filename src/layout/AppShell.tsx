import { Navigate, Outlet, useLocation } from 'react-router'
import { useLogPending } from '../brew/useLogPending'
import { useFlushOutbox } from '../data/hooks'
import { TabBar } from './TabBar'

export function AppShell() {
  useFlushOutbox()
  const logPending = useLogPending()
  const { pathname } = useLocation()

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
