import { NavLink, useMatch } from 'react-router'
import { LayoutDashboard, Wallet, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const TOP_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { id: 'budget', icon: Wallet, label: 'Budget', to: '/budget' },
  { id: 'spaces', icon: Users, label: 'Spaces', to: '/spaces' },
]

const BOTTOM_ITEMS = [{ id: 'settings', icon: Settings, label: 'Settings', to: '/settings' }]

function RailIcon({ icon: Icon, label, to }: { icon: React.ElementType; label: string; to: string }) {
  const isActive = useMatch({ path: to, end: false })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          aria-label={label}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Icon className="h-6 w-6" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function PrimaryRail() {
  return (
    <nav className="flex w-16 flex-col items-center border-r border-border bg-card py-3">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
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
