import { Outlet } from 'react-router'
import { TabBar } from './TabBar'

export function AppShell() {
  return (
    <div className="mx-auto min-h-dvh max-w-xl pt-[env(safe-area-inset-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <main className="px-4 pt-6 pb-8">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
