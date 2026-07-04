import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { currentMonth, stepMonth, formatMonth, currentWeekStart, stepWeek, formatWeekRange } from '@/lib/dates'
import { spaceLocale } from '@/lib/locale'
import { useCategories, useReport, type ReportPeriodType, type ReportRow } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b']

function usePeriod(locale = 'en-US') {
  const [type, setType] = useState<ReportPeriodType>('month')
  const [month, setMonth] = useState(currentMonth())
  const [week, setWeek] = useState(currentWeekStart())
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const value = type === 'month' ? month : type === 'week' ? week : year
  const label = type === 'month' ? formatMonth(month, locale) : type === 'week' ? formatWeekRange(week, locale) : year

  const step = (delta: number) => {
    if (type === 'month') setMonth(stepMonth(month, delta))
    else if (type === 'week') setWeek(stepWeek(week, delta))
    else setYear(String(Number(year) + delta))
  }

  const isCurrent =
    type === 'month'
      ? month === currentMonth()
      : type === 'week'
        ? week === currentWeekStart()
        : year === String(new Date().getFullYear())

  const resetToToday = () => {
    if (type === 'month') setMonth(currentMonth())
    else if (type === 'week') setWeek(currentWeekStart())
    else setYear(String(new Date().getFullYear()))
  }

  return { type, setType, value, label, step, isCurrent, resetToToday }
}

function SummaryCard({ title, value, className }: { title: string; value: string; className?: string }) {
  return (
    <Card className="flex-1">
      <CardContent className="py-4 text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
        <p className={cn('mt-1 text-lg font-bold', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}

export function ReportsPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const { type, setType, value, label, step, isCurrent, resetToToday } = usePeriod(
    space ? spaceLocale(space) : undefined
  )
  const { data: categories = [] } = useCategories(space?.id ?? null)
  const { data: rows = [], isLoading } = useReport(space?.id ?? null, type, value)

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
  const incomeCategoryIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id))
  const expenseRows: ReportRow[] = rows.filter((r) => !incomeCategoryIds.has(r.category_id))
  const incomeRows: ReportRow[] = rows.filter((r) => incomeCategoryIds.has(r.category_id))
  const expenseTotal = expenseRows.reduce((sum, r) => sum + Number(r.total), 0)
  const incomeTotal = incomeRows.reduce((sum, r) => sum + Number(r.total), 0)
  const net = incomeTotal - expenseTotal

  const chartData = expenseRows.map((r) => ({ name: r.category_name, value: Number(r.total) }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={type} onValueChange={(v) => setType(v as ReportPeriodType)}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="previous period" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold">{label}</span>
          <Button variant="ghost" size="icon" aria-label="next period" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrent && (
            <Button variant="ghost" size="sm" onClick={resetToToday}>
              Today
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No data for this period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-3">
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

          {expenseRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Expenses by category
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
                <PieChart width={220} height={220}>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="w-full flex-1 space-y-1">
                  {expenseRows.map((r) => (
                    <div key={r.category_id} className="flex items-center justify-between py-1 text-sm">
                      <span>
                        {r.category_icon} {r.category_name}
                      </span>
                      <span className="font-semibold">
                        {formatMoney(r.total, space.currency, locale)}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {expenseTotal > 0 ? Math.round((Number(r.total) / expenseTotal) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {incomeRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Income
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {incomeRows.map((r) => (
                  <div key={r.category_id} className="flex items-center justify-between py-1 text-sm">
                    <span>
                      {r.category_icon} {r.category_name}
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      +{formatMoney(r.total, space.currency, locale)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
