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
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 z-50 flex bg-background border-r border-border shadow-lg">
        <PrimaryRail />
        <ContextPanel />
        <button
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </>
  )
}
