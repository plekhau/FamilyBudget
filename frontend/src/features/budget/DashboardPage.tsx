import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatMoney } from '@/lib/money'
import { currentMonth, formatMonth } from '@/lib/dates'
import { spaceLocale } from '@/lib/locale'
import { useCategories, useReport } from '@/hooks/useBudget'
import { splitReportRows } from './reportRows'
import { SummaryCard } from './SummaryCard'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'

type DashboardPeriod = 'month' | 'year'

export function DashboardPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const periodValue = period === 'month' ? currentMonth() : String(new Date().getFullYear())
  const { data: categories = [] } = useCategories(space?.id ?? null)
  const { data: reportRows = [], isLoading: reportLoading } = useReport(space?.id ?? null, period, periodValue)

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const locale = spaceLocale(space)
  const periodLabel = period === 'month' ? formatMonth(periodValue, locale) : periodValue
  const { incomeTotal, expenseTotal, net } = splitReportRows(reportRows, categories)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {periodLabel} · {space.name}
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {reportLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="summary-cards">
          <SummaryCard
            title="Income"
            value={formatMoney(incomeTotal, space.currency, locale)}
            className="text-green-600 dark:text-green-400"
          />
          <SummaryCard title="Expenses" value={formatMoney(expenseTotal, space.currency, locale)} />
          <SummaryCard
            title="Net"
            value={`${net >= 0 ? '+' : ''}${formatMoney(net, space.currency, locale)}`}
            className={net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}
          />
        </div>
      )}
    </div>
  )
}
