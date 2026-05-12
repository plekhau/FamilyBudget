import { NavLink, useLocation } from 'react-router'
import { cn } from '@/lib/utils'

const SECTION_ITEMS: Record<string, { label: string; to: string }[]> = {
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
    <nav className="flex w-44 flex-col border-r border-border bg-card px-2 py-3">
      <p className="mb-2 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{activeSection}</p>
      {items.map(({ label, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-primary/10 font-medium text-primary'
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
