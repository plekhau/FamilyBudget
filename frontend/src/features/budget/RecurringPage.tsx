import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { formatDayHeading } from '@/lib/dates'
import { spaceLocale } from '@/lib/locale'
import { useCategories, useRecurring, useUpdateRecurring, type RecurringTransaction } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { RecurringDialog } from './RecurringDialog'

export function RecurringPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const { data: recurring = [], isLoading } = useRecurring(space?.id ?? null)
  const { data: categories = [] } = useCategories(space?.id ?? null)
  const updateRecurring = useUpdateRecurring(space?.id ?? 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)

  if (spaceLoading || isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const locale = spaceLocale(space)
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const handleToggle = (item: RecurringTransaction, checked: boolean) => {
    updateRecurring.mutate(
      { id: item.id, is_active: checked },
      { onError: () => toast.error('Failed to update. Please try again.') }
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Recurring</h1>
          <p className="text-sm text-muted-foreground">Repeating expenses and income in {space.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add recurring
        </Button>
      </div>

      {recurring.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No recurring transactions yet.</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add recurring
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border py-0">
            {recurring.map((item) => {
              const category = categoryById.get(item.category)
              return (
                <div key={item.id} className={cn('flex items-center gap-3 py-2.5', !item.is_active && 'opacity-50')}>
                  <button type="button" className="flex-1 text-left" onClick={() => setEditing(item)}>
                    <p className="text-sm font-medium">
                      {category?.icon} {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.frequency} ·{' '}
                      {item.is_active ? `next: ${formatDayHeading(item.next_due_date, locale)}` : 'paused'}
                    </p>
                  </button>
                  <span className="text-sm font-semibold">{formatMoney(item.amount, space.currency, locale)}</span>
                  <Switch
                    checked={item.is_active}
                    aria-label={`toggle ${item.description}`}
                    onCheckedChange={(checked) => handleToggle(item, checked)}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Recurring transactions are added to your history automatically when they come due.
      </p>

      <RecurringDialog
        open={dialogOpen || editing !== null}
        recurring={editing}
        space={space}
        categories={categories}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
