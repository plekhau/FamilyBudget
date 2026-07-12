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

interface RailItemProps {
  icon: React.ElementType
  label: string
  to: string
  showLabel?: boolean
}

function RailItem({ icon: Icon, label, to, showLabel }: RailItemProps) {
  const isActive = useMatch({ path: to, end: false })
  const link = (
    <NavLink
      to={to}
      aria-label={label}
      className={cn(
        'flex items-center rounded-lg transition-colors',
        showLabel ? 'h-10 w-full gap-3 px-3' : 'h-10 w-10 justify-center',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-6 w-6 shrink-0" />
      {showLabel && <span className="text-sm font-medium">{label}</span>}
    </NavLink>
  )

  if (showLabel) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

interface PrimaryRailProps {
  /** Render item labels inline (used by the mobile drawer instead of tooltips). */
  showLabels?: boolean
  className?: string
}

export function PrimaryRail({ showLabels = false, className }: PrimaryRailProps) {
  return (
    <nav
      className={cn(
        'flex flex-col border-r border-border bg-card py-3',
        showLabels ? 'w-48 px-2' : 'w-16 items-center',
        className
      )}
    >
      <div className={cn('mb-4 flex items-center gap-3', showLabels && 'px-3')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          F
        </div>
        {showLabels && <span className="text-sm font-bold">FamilyBudget</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {TOP_ITEMS.map((item) => (
          <RailItem key={item.id} {...item} showLabel={showLabels} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {BOTTOM_ITEMS.map((item) => (
          <RailItem key={item.id} {...item} showLabel={showLabels} />
        ))}
      </div>
    </nav>
  )
}
