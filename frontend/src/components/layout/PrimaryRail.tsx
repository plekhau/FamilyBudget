import { NavLink } from 'react-router'
import { LayoutDashboard, Wallet, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOP_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { id: 'budget', icon: Wallet, label: 'Budget', to: '/budget' },
  { id: 'spaces', icon: Users, label: 'Spaces', to: '/spaces' },
]

const BOTTOM_ITEMS = [{ id: 'settings', icon: Settings, label: 'Settings', to: '/settings' }]

function RailIcon({ icon: Icon, label, to }: { icon: React.ElementType; label: string; to: string }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )
      }
    >
      <Icon className="h-4 w-4" />
    </NavLink>
  )
}

export function PrimaryRail() {
  return (
    <nav className="flex w-14 flex-col items-center border-r border-border bg-card py-3">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        F
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {TOP_ITEMS.map((item) => (
          <RailIcon key={item.id} {...item} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {BOTTOM_ITEMS.map((item) => (
          <RailIcon key={item.id} {...item} />
        ))}
      </div>
    </nav>
  )
}
