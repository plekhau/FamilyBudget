import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { currentMonth, stepMonth, formatMonth, formatDayHeading } from '@/lib/dates'
import { spaceLocale } from '@/lib/locale'
import { useCategories, useTransactions, type Transaction } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { TransactionDialog } from './TransactionDialog'
import { CategoryLabel } from './CategoryLabel'

function groupByDay(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const groups: { date: string; items: Transaction[] }[] = []
  for (const t of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }
  return groups
}

interface DayHeadingProps {
  date: string
  items: Transaction[]
  locale: string
  categoryById: Map<number, { is_income: boolean }>
  space: { currency: string }
}

function DayHeading({ date, items, locale, categoryById, space }: DayHeadingProps) {
  const isIncomeTx = (t: Transaction) => categoryById.get(t.category)?.is_income ?? false
  const dayNet = items.reduce((sum, t) => sum + (isIncomeTx(t) ? Number(t.amount) : -Number(t.amount)), 0)

  return (
    <div className="mb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      <span>{formatDayHeading(date, locale)}</span>
      {items.length > 1 && (
        <span data-testid={`day-total-${date}`} className={cn(dayNet > 0 && 'text-green-600 dark:text-green-400')}>
          {dayNet > 0
            ? `+${formatMoney(dayNet, space.currency, locale)}`
            : `${dayNet < 0 ? '-' : ''}${formatMoney(-dayNet, space.currency, locale)}`}
        </span>
      )}
    </div>
  )
}

export function TransactionsPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const [month, setMonth] = useState(currentMonth())
  const [categoryId, setCategoryId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data: categories = [] } = useCategories(space?.id ?? null)
  const { data: transactions = [], isLoading } = useTransactions(space?.id ?? null, {
    month,
    categoryId: categoryId ? Number(categoryId) : undefined,
  })

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const locale = spaceLocale(space)
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const memberById = new Map(space.members.map((m) => [m.user.id, m.user.display_name]))
  const groups = groupByDay(transactions)

  const isIncomeTx = (t: Transaction) => categoryById.get(t.category)?.is_income ?? false
  const monthIncome = transactions.filter(isIncomeTx).reduce((sum, t) => sum + Number(t.amount), 0)
  const monthExpenses = transactions.filter((t) => !isIncomeTx(t)).reduce((sum, t) => sum + Number(t.amount), 0)
  const monthNet = monthIncome - monthExpenses

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="previous month"
            onClick={() => setMonth(stepMonth(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="min-w-32 text-center text-lg font-bold">{formatMonth(month, locale)}</h1>
          <Button variant="ghost" size="icon" aria-label="next month" onClick={() => setMonth(stepMonth(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {month !== currentMonth() && (
            <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
            aria-label="filter by category"
            className="w-40"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No transactions in {formatMonth(month, locale)}.</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm" data-testid="month-summary">
            <span className="text-green-600 dark:text-green-400">
              Income +{formatMoney(monthIncome, space.currency, locale)}
            </span>
            <span className="text-muted-foreground">
              {' '}
              · Spent {formatMoney(monthExpenses, space.currency, locale)} · Net{' '}
            </span>
            <span
              className={cn('font-semibold', monthNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive')}
            >
              {monthNet >= 0 ? '+' : ''}
              {formatMoney(monthNet, space.currency, locale)}
            </span>
          </p>
          {groups.map((group) => (
            <div key={group.date}>
              <DayHeading
                date={group.date}
                items={group.items}
                locale={locale}
                categoryById={categoryById}
                space={space}
              />
              <Card className="py-2">
                <CardContent className="divide-y divide-border py-0">
                  {group.items.map((t) => {
                    const category = categoryById.get(t.category)
                    const isIncome = category?.is_income ?? false
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/50"
                        onClick={() => setEditing(t)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {category ? (
                              <CategoryLabel icon={category.icon} name={category.name} />
                            ) : (
                              'Unknown category'
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span>{memberById.get(t.paid_by) ?? 'Unknown'}</span>
                            {t.notes && <span> · {t.notes}</span>}
                          </p>
                        </div>
                        <span className={cn('text-sm font-semibold', isIncome && 'text-green-600 dark:text-green-400')}>
                          {isIncome
                            ? `+${formatMoney(t.amount, space.currency, locale)}`
                            : `-${formatMoney(t.amount, space.currency, locale)}`}
                        </span>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <TransactionDialog
        open={dialogOpen || editing !== null}
        transaction={editing}
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
