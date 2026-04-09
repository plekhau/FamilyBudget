import { NavLink, useLocation } from 'react-router'
import { cn } from '@/lib/utils'

const SECTION_ITEMS: Record<string, Array<{ label: string; to: string }>> = {
  budget: [
    { label: 'Transactions', to: '/budget/transactions' },
    { label: 'Categories', to: '/budget/categories' },
    { label: 'Recurring', to: '/budget/recurring' },
    { label: 'Reports', to: '/budget/reports' },
  ],
}

function useActiveSection(): string | null {
  const { pathname } = useLocation()
  if (pathname.startsWith('/budget')) return 'budget'
  if (pathname.startsWith('/spaces')) return 'spaces'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  return null
}

export function ContextPanel() {
  const activeSection = useActiveSection()
  const items = activeSection ? SECTION_ITEMS[activeSection] : null

  if (!items || items.length === 0) return null

  return (
    <nav className="w-44 bg-card border-r border-border flex flex-col py-3 px-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
        {activeSection}
      </p>
      {items.map(({ label, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'px-2 py-1.5 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
