import { NavLink } from 'react-router'
import { LayoutDashboard, Wallet, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOP_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { id: 'budget', icon: Wallet, label: 'Budget', to: '/budget' },
  { id: 'spaces', icon: Users, label: 'Spaces', to: '/spaces' },
]

const BOTTOM_ITEMS = [
  { id: 'settings', icon: Settings, label: 'Settings', to: '/settings' },
]

function RailIcon({
  icon: Icon,
  label,
  to,
}: {
  icon: React.ElementType
  label: string
  to: string
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )
      }
    >
      <Icon className="w-4 h-4" />
    </NavLink>
  )
}

export function PrimaryRail() {
  return (
    <nav className="w-14 bg-card flex flex-col items-center py-3 border-r border-border">
      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm mb-4">
        F
      </div>
      <div className="flex flex-col gap-1 flex-1">
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
