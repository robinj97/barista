import { Outlet } from 'react-router'
import { useFlushOutbox } from '../data/hooks'
import { TabBar } from './TabBar'

export function AppShell() {
  useFlushOutbox()
  return (
    <div className="mx-auto min-h-dvh max-w-xl pt-[env(safe-area-inset-top)] pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <main className="px-5 pt-8">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
