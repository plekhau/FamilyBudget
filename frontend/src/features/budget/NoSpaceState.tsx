import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NoSpaceState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl"
      >
        🏠
      </div>
      <h2 className="text-lg font-semibold">Welcome to FamilyBudget</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a space to start tracking your budget. A space is a shared budget for your household — invite the family
        and track spending together.
      </p>
      <Button asChild className="mt-6">
        <Link to="/spaces">Go to Spaces</Link>
      </Button>
    </div>
  )
}
