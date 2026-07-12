import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { X } from 'lucide-react'
import { PrimaryRail } from './PrimaryRail'
import { ContextPanel } from './ContextPanel'

interface Props {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: Props) {
  const { pathname } = useLocation()

  // Close drawer when the user navigates to a new route
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-border bg-card shadow-lg">
        <PrimaryRail showLabels className="w-full border-r-0" />
        <ContextPanel className="w-full border-t border-r-0" />
        <button
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  )
}
