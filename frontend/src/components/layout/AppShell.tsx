import { useState } from 'react'
import { Outlet } from 'react-router'
import { Menu } from 'lucide-react'
import { PrimaryRail } from './PrimaryRail'
import { ContextPanel } from './ContextPanel'
import { MobileDrawer } from './MobileDrawer'

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar: always visible at md+ */}
      <div className="hidden md:flex flex-shrink-0">
        <PrimaryRail />
        <ContextPanel />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center h-12 px-4 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-bold text-sm">FamilyBudget</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
