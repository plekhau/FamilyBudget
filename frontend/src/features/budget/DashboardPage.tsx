import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatMoney } from '@/lib/money'
import { currentMonth, formatMonth, formatDayHeading } from '@/lib/dates'
import { spaceLocale } from '@/lib/locale'
import { useCategories, useReport, useRecurring, type ReportRow, type RecurringTransaction } from '@/hooks/useBudget'
import { splitReportRows } from './reportRows'
import { SummaryCard } from './SummaryCard'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { FREQUENCY_LABELS } from './frequency'

type DashboardPeriod = 'month' | 'year'

const TOP_CATEGORIES_LIMIT = 5
const UPCOMING_LIMIT = 5

function TopCategories({
  expenseRows,
  expenseTotal,
  currency,
  locale,
}: {
  expenseRows: ReportRow[]
  expenseTotal: number
  currency: string
  locale: string
}) {
  const top = expenseRows.slice(0, TOP_CATEGORIES_LIMIT)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Top categories
        </CardTitle>
        <Link to="/budget/reports" className="text-xs font-medium text-primary hover:underline">
          View report →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses this period.</p>
        ) : (
          top.map((r) => {
            const pct = expenseTotal > 0 ? Math.round((Number(r.total) / expenseTotal) * 100) : 0
            return (
              <div key={r.category_id} data-testid="top-category-row">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {r.category_icon} {r.category_name}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(r.total, currency, locale)}{' '}
                    <span className="font-normal text-muted-foreground">· {pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function UpcomingRecurring({
  recurring,
  currency,
  locale,
}: {
  recurring: RecurringTransaction[]
  currency: string
  locale: string
}) {
  const upcoming = recurring
    .filter((r) => r.is_active)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    .slice(0, UPCOMING_LIMIT)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Upcoming recurring
        </CardTitle>
        <Link to="/budget/recurring" className="text-xs font-medium text-primary hover:underline">
          Manage →
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active recurring payments.</p>
        ) : (
          upcoming.map((r) => (
            <div key={r.id} data-testid="upcoming-row" className="flex items-center justify-between py-1 text-sm">
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{r.description}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDayHeading(r.next_due_date, locale)} · {FREQUENCY_LABELS[r.frequency]}
                </span>
              </span>
              <span className="font-semibold">{formatMoney(r.amount, currency, locale)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const periodValue = period === 'month' ? currentMonth() : String(new Date().getFullYear())
  const { data: categories = [] } = useCategories(space?.id ?? null)
  const { data: reportRows = [], isLoading: reportLoading } = useReport(space?.id ?? null, period, periodValue)
  const { data: recurring = [] } = useRecurring(space?.id ?? null)

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
  const { incomeTotal, expenseTotal, net, expenseRows } = splitReportRows(reportRows, categories)

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
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
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
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
            <TopCategories
              expenseRows={expenseRows}
              expenseTotal={expenseTotal}
              currency={space.currency}
              locale={locale}
            />
            <UpcomingRecurring recurring={recurring} currency={space.currency} locale={locale} />
          </div>
        </>
      )}
    </div>
  )
}
