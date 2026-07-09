# Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/dashboard` "coming soon" stub with a dashboard page showing period summary tiles, top spending categories, upcoming recurring payments, and recent transactions — frontend only, composing existing APIs.

**Architecture:** One new lazy-loaded page (`src/features/budget/DashboardPage.tsx`) consuming the existing TanStack Query hooks (`useReport`, `useCategories`, `useTransactions`, `useRecurring`). Two small shared extractions so nothing is duplicated: the income/expense report split (currently inlined in ReportsPage) and the `SummaryCard` stat tile (also in ReportsPage — extracted so the dashboard chunk does not pull in Recharts). Spec: `docs/superpowers/specs/2026-07-09-dashboard-page-design.md`.

**Tech Stack:** React 19, TypeScript, TanStack Query, shadcn/ui (Card/Tabs/Skeleton), Tailwind v4, Vitest + Testing Library + MSW v2.

## Global Constraints

- Frontend only — no backend changes of any kind.
- All commands run from `frontend/` with `pnpm`.
- Tests: docstring comment on every test; no imports inside test functions.
- Amounts formatted with `formatMoney(amount, space.currency, spaceLocale(space))`; income and positive net use `text-green-600 dark:text-green-400`, negative net uses `text-destructive`.
- Dashboard has no period stepping: month = `currentMonth()`, year = `String(new Date().getFullYear())`.
- Before each commit the pre-commit hook runs prettier/eslint on staged files; run `pnpm lint:fix && pnpm format` first to avoid surprises.
- Existing ReportsPage and RecurringPage test suites must stay green after the extractions.

---

### Task 1: `splitReportRows` helper (extract from ReportsPage)

**Files:**
- Create: `frontend/src/features/budget/reportRows.ts`
- Modify: `frontend/src/features/budget/ReportsPage.tsx:94-101`
- Test: `frontend/src/features/budget/__tests__/reportRows.test.ts`

**Interfaces:**
- Consumes: `Category`, `ReportRow` types from `@/hooks/useBudget`.
- Produces: `splitReportRows(rows: ReportRow[], categories: Category[]): { incomeRows: ReportRow[]; expenseRows: ReportRow[]; incomeTotal: number; expenseTotal: number; net: number }` — `expenseRows` sorted by total descending. Task 2 imports this.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/budget/__tests__/reportRows.test.ts`:

```ts
import { splitReportRows } from '../reportRows'
import type { Category, ReportRow } from '@/hooks/useBudget'

const categories: Category[] = [
  { id: 1, name: 'Groceries', icon: '🛒', is_income: false, transaction_count: 0 },
  { id: 2, name: 'Dining Out', icon: '🍽️', is_income: false, transaction_count: 0 },
  { id: 3, name: 'Salary', icon: '💰', is_income: true, transaction_count: 0 },
]

const rows: ReportRow[] = [
  { category_id: 1, category_name: 'Groceries', category_icon: '🛒', total: '84.20' },
  { category_id: 2, category_name: 'Dining Out', category_icon: '🍽️', total: '132.50' },
  { category_id: 3, category_name: 'Salary', category_icon: '💰', total: '2400.00' },
]

describe('splitReportRows', () => {
  it('splits rows into income and expenses using is_income flags', () => {
    /** Salary lands in incomeRows; Groceries and Dining Out land in expenseRows. */
    const result = splitReportRows(rows, categories)
    expect(result.incomeRows.map((r) => r.category_id)).toEqual([3])
    expect(result.expenseRows.map((r) => r.category_id)).toEqual([2, 1])
  })

  it('sorts expense rows by total descending', () => {
    /** Dining Out (132.50) comes before Groceries (84.20). */
    const result = splitReportRows(rows, categories)
    expect(result.expenseRows[0].total).toBe('132.50')
  })

  it('computes income, expense and net totals', () => {
    /** incomeTotal 2400, expenseTotal 216.70, net 2183.30 (floating-point tolerant). */
    const result = splitReportRows(rows, categories)
    expect(result.incomeTotal).toBe(2400)
    expect(result.expenseTotal).toBeCloseTo(216.7)
    expect(result.net).toBeCloseTo(2183.3)
  })

  it('treats rows with unknown categories as expenses', () => {
    /** A row whose category is not in the list is counted as an expense, matching ReportsPage behavior. */
    const orphan: ReportRow[] = [{ category_id: 99, category_name: 'Ghost', category_icon: '', total: '10.00' }]
    const result = splitReportRows(orphan, categories)
    expect(result.expenseRows).toHaveLength(1)
    expect(result.incomeRows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run src/features/budget/__tests__/reportRows.test.ts`
Expected: FAIL — cannot resolve `../reportRows`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/features/budget/reportRows.ts`:

```ts
import type { Category, ReportRow } from '@/hooks/useBudget'

export interface SplitReportRows {
  incomeRows: ReportRow[]
  expenseRows: ReportRow[]
  incomeTotal: number
  expenseTotal: number
  net: number
}

export function splitReportRows(rows: ReportRow[], categories: Category[]): SplitReportRows {
  const incomeCategoryIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id))
  const expenseRows = rows
    .filter((r) => !incomeCategoryIds.has(r.category_id))
    .sort((a, b) => Number(b.total) - Number(a.total))
  const incomeRows = rows.filter((r) => incomeCategoryIds.has(r.category_id))
  const expenseTotal = expenseRows.reduce((sum, r) => sum + Number(r.total), 0)
  const incomeTotal = incomeRows.reduce((sum, r) => sum + Number(r.total), 0)
  return { incomeRows, expenseRows, incomeTotal, expenseTotal, net: incomeTotal - expenseTotal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run src/features/budget/__tests__/reportRows.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Refactor ReportsPage to use the helper**

In `frontend/src/features/budget/ReportsPage.tsx` replace lines 94–101:

```tsx
  const incomeCategoryIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id))
  const expenseRows: ReportRow[] = rows
    .filter((r) => !incomeCategoryIds.has(r.category_id))
    .sort((a, b) => Number(b.total) - Number(a.total))
  const incomeRows: ReportRow[] = rows.filter((r) => incomeCategoryIds.has(r.category_id))
  const expenseTotal = expenseRows.reduce((sum, r) => sum + Number(r.total), 0)
  const incomeTotal = incomeRows.reduce((sum, r) => sum + Number(r.total), 0)
  const net = incomeTotal - expenseTotal
```

with:

```tsx
  const { incomeRows, expenseRows, incomeTotal, expenseTotal, net } = splitReportRows(rows, categories)
```

Add `import { splitReportRows } from './reportRows'` after the `useBudget` import. Remove `ReportRow` from the `useBudget` import if it becomes unused (`useCategories, useReport, type ReportPeriodType` remain).

- [ ] **Step 6: Run the full frontend suite**

Run: `pnpm test --run`
Expected: all tests pass (ReportsPage tests unchanged and green).

- [ ] **Step 7: Commit**

```bash
git add src/features/budget/reportRows.ts src/features/budget/__tests__/reportRows.test.ts src/features/budget/ReportsPage.tsx
git commit -m "refactor(frontend): extract splitReportRows helper from ReportsPage"
```

---

### Task 2: DashboardPage shell — route, header, Month/Year toggle, summary tiles

**Files:**
- Create: `frontend/src/features/budget/SummaryCard.tsx`
- Create: `frontend/src/features/budget/DashboardPage.tsx`
- Modify: `frontend/src/features/budget/ReportsPage.tsx:64-73` (delete local `SummaryCard`, import shared one)
- Modify: `frontend/src/router/index.tsx:61` (replace `ComingSoon` stub; the stub component itself stays for other routes — after this change nothing references it, so delete the `ComingSoon` function too)
- Test: `frontend/src/features/budget/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `splitReportRows` from Task 1; `useReport`, `useCategories` hooks; `SummaryCard`.
- Produces: `DashboardPage` (named export) registered at `/dashboard`; `SummaryCard({ title, value, className? })` (named export); the page renders a `data-testid="summary-cards"` grid. Tasks 3–5 append widgets to this page's JSX and its test file.

- [ ] **Step 1: Extract SummaryCard**

Create `frontend/src/features/budget/SummaryCard.tsx` (verbatim from ReportsPage lines 64–73):

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function SummaryCard({ title, value, className }: { title: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4 sm:flex-col sm:justify-center sm:text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
        <p className={cn('text-lg font-bold sm:mt-1', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}
```

In `ReportsPage.tsx`: delete the local `SummaryCard` function (lines 64–73) and add `import { SummaryCard } from './SummaryCard'`. Run `pnpm test --run src/features/budget/__tests__/ReportsPage.test.tsx` — expected: pass.

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/features/budget/__tests__/DashboardPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { mockReport } from '@/mocks/handlers'
import { DashboardPage } from '../DashboardPage'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

const BASE = 'http://localhost:8000'

function renderPage() {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  useSpaceStore.setState({ selectedSpaceId: 1 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('shows income, expenses and net summary tiles', async () => {
    /** From the mocked report: Salary 2400 is income; Groceries 84.20 + Dining Out 32.50 are expenses; net +2283.30. */
    renderPage()
    expect(await screen.findByText('$2,400.00')).toBeInTheDocument()
    expect(screen.getByText('$116.70')).toBeInTheDocument()
    expect(screen.getByText('+$2,283.30')).toBeInTheDocument()
  })

  it('requests the yearly report when switching the toggle to Year', async () => {
    /** The Month/Year tabs drive the report query: Year requests yearly-summary for the current year. */
    const requested: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, ({ params }) => {
        requested.push(String(params.reportType))
        return HttpResponse.json(mockReport)
      })
    )
    renderPage()
    await screen.findByText('$2,400.00')
    await userEvent.click(screen.getByRole('tab', { name: /year/i }))
    await waitFor(() => expect(requested).toContain('yearly-summary'))
  })

  it('shows the no-space state when the user has no spaces', async () => {
    /** With no spaces, the dashboard renders NoSpaceState instead of widgets. */
    server.use(http.get(`${BASE}/api/spaces/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/create a space to start tracking your budget/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: FAIL — cannot resolve `../DashboardPage`.

- [ ] **Step 4: Write the page**

Create `frontend/src/features/budget/DashboardPage.tsx`:

```tsx
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
```

- [ ] **Step 5: Register the route**

In `frontend/src/router/index.tsx`:

Add with the other lazy imports:

```tsx
const DashboardPage = lazy(() => import('@/features/budget/DashboardPage').then((m) => ({ default: m.DashboardPage })))
```

Replace line 61 (`{ path: '/dashboard', element: <ComingSoon title="Dashboard" /> },`) with:

```tsx
          {
            path: '/dashboard',
            element: (
              <Suspense fallback={<Loader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
```

Delete the now-unused `ComingSoon` function (lines 25–27).

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: 3 passed. Then `pnpm test --run` — all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/budget/DashboardPage.tsx src/features/budget/SummaryCard.tsx src/features/budget/ReportsPage.tsx src/features/budget/__tests__/DashboardPage.test.tsx src/router/index.tsx
git commit -m "feat(frontend): dashboard page shell with period toggle and summary tiles"
```

---

### Task 3: Top categories widget

**Files:**
- Modify: `frontend/src/features/budget/DashboardPage.tsx`
- Test: `frontend/src/features/budget/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `expenseRows`/`expenseTotal` from `splitReportRows` (already computed in the page).
- Produces: rows tagged `data-testid="top-category-row"`; a two-column grid `<div className="grid grid-cols-1 gap-6 md:grid-cols-2">` that Task 4 adds its card into.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('DashboardPage', ...)`:

```tsx
  it('lists top expense categories with percentages, capped at 5', async () => {
    /** Six expense categories are mocked; only the top 5 by total render, sorted descending, with % of expense total. */
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, () =>
        HttpResponse.json([
          { category_id: 1, category_name: 'Rent', category_icon: '🏠', total: '500.00' },
          { category_id: 2, category_name: 'Food', category_icon: '🍎', total: '250.00' },
          { category_id: 3, category_name: 'Fuel', category_icon: '⛽', total: '120.00' },
          { category_id: 4, category_name: 'Fun', category_icon: '🎬', total: '80.00' },
          { category_id: 5, category_name: 'Gym', category_icon: '🏋️', total: '40.00' },
          { category_id: 6, category_name: 'Misc', category_icon: '📦', total: '10.00' },
        ])
      )
    )
    renderPage()
    const rows = await screen.findAllByTestId('top-category-row')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('🏠 Rent')
    expect(rows[0]).toHaveTextContent('50%')
    expect(screen.queryByText(/📦 Misc/)).not.toBeInTheDocument()
  })

  it('shows an empty message when there are no expenses this period', async () => {
    /** With an income-only report, the top-categories card shows its empty state. */
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, () =>
        HttpResponse.json([{ category_id: 3, category_name: 'Salary', category_icon: '💰', total: '2400.00' }])
      )
    )
    renderPage()
    expect(await screen.findByText(/no expenses this period/i)).toBeInTheDocument()
  })
```

(The six mocked categories are not in `mockCategories`, so none are income — exactly what the cap test needs; percentages: 500/1000 = 50%.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: the two new tests FAIL (no `top-category-row` testid); the three existing ones pass.

- [ ] **Step 3: Implement the widget**

In `DashboardPage.tsx`:

Add imports:

```tsx
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type ReportRow } from '@/hooks/useBudget'
```

Add the component above `DashboardPage`:

```tsx
const TOP_CATEGORIES_LIMIT = 5

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
```

In the page body, change the destructuring to include `expenseRows`:

```tsx
  const { incomeTotal, expenseTotal, net, expenseRows } = splitReportRows(reportRows, categories)
```

and append after the summary-cards block (inside the outer `space-y-6` div, still within the `reportLoading` ternary's false branch — restructure to keep tiles + top categories together):

```tsx
      {reportLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="summary-cards">
            {/* ...existing three SummaryCards unchanged... */}
          </div>
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
            <TopCategories
              expenseRows={expenseRows}
              expenseTotal={expenseTotal}
              currency={space.currency}
              locale={locale}
            />
          </div>
        </>
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/budget/DashboardPage.tsx src/features/budget/__tests__/DashboardPage.test.tsx
git commit -m "feat(frontend): dashboard top-categories widget"
```

---

### Task 4: Upcoming recurring widget (+ shared frequency labels)

**Files:**
- Create: `frontend/src/features/budget/frequency.ts`
- Modify: `frontend/src/features/budget/RecurringPage.tsx:17-21` (use shared labels)
- Modify: `frontend/src/features/budget/DashboardPage.tsx`
- Test: `frontend/src/features/budget/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useRecurring(spaceId)` hook; `formatDayHeading` from `@/lib/dates`.
- Produces: `FREQUENCY_LABELS: Record<RecurringTransaction['frequency'], string>` exported from `frequency.ts`; rows tagged `data-testid="upcoming-row"` inside the Task 3 two-column grid.

- [ ] **Step 1: Extract frequency labels**

Create `frontend/src/features/budget/frequency.ts`:

```ts
import type { RecurringTransaction } from '@/hooks/useBudget'

export const FREQUENCY_LABELS: Record<RecurringTransaction['frequency'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
```

In `RecurringPage.tsx`: delete the local `FREQUENCY_LABELS` const (lines 17–21) and add `import { FREQUENCY_LABELS } from './frequency'`. Run `pnpm test --run src/features/budget/__tests__/RecurringPage.test.tsx` — expected: pass.

- [ ] **Step 2: Write the failing tests**

Append inside `describe('DashboardPage', ...)`:

```tsx
  it('lists active recurring entries sorted by next due date, capped at 5', async () => {
    /** Seven recurring entries are mocked (one inactive); the 5 soonest active ones render in due-date order. */
    const recurringEntry = (id: number, description: string, next_due_date: string, is_active = true) => ({
      id,
      space: 1,
      category: 1,
      amount: '10.00',
      description,
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_due_date,
      is_active,
    })
    server.use(
      http.get(`${BASE}/api/budgets/recurring-transactions/`, () =>
        HttpResponse.json([
          recurringEntry(1, 'Rent', '2026-08-01'),
          recurringEntry(2, 'Netflix', '2026-07-15'),
          recurringEntry(3, 'Gym', '2026-07-20'),
          recurringEntry(4, 'Cancelled Box', '2026-07-10', false),
          recurringEntry(5, 'Insurance', '2026-09-01'),
          recurringEntry(6, 'Spotify', '2026-07-12'),
          recurringEntry(7, 'Domain', '2026-12-01'),
        ])
      )
    )
    renderPage()
    const rows = await screen.findAllByTestId('upcoming-row')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('Spotify')
    expect(rows[1]).toHaveTextContent('Netflix')
    expect(screen.queryByText('Cancelled Box')).not.toBeInTheDocument()
    expect(screen.queryByText('Domain')).not.toBeInTheDocument()
  })

  it('shows an empty message when there are no active recurring entries', async () => {
    /** With an empty recurring list, the upcoming card shows its empty state. */
    server.use(http.get(`${BASE}/api/budgets/recurring-transactions/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/no active recurring payments/i)).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: the two new tests FAIL (no `upcoming-row` testid, no empty message); previous 5 pass.

- [ ] **Step 4: Implement the widget**

In `DashboardPage.tsx`:

Add imports:

```tsx
import { formatDayHeading } from '@/lib/dates'
import { useRecurring, type RecurringTransaction } from '@/hooks/useBudget'
import { FREQUENCY_LABELS } from './frequency'
```

(merge into the existing import lines — `currentMonth, formatMonth, formatDayHeading` from dates; `useCategories, useReport, useRecurring, type ReportRow, type RecurringTransaction` from useBudget).

Add the component above `DashboardPage`:

```tsx
const UPCOMING_LIMIT = 5

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
```

In `DashboardPage` add the hook call next to the others:

```tsx
  const { data: recurring = [] } = useRecurring(space?.id ?? null)
```

and render `<UpcomingRecurring recurring={recurring} currency={space.currency} locale={locale} />` as the second child of the Task 3 two-column grid. Keep the card inside the `reportLoading` false branch with the rest of the widgets — making it render independently would complicate the ternary for no user-visible gain (matches ReportsPage's all-or-nothing rendering).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: 7 passed. Also run `pnpm test --run src/features/budget/__tests__/RecurringPage.test.tsx` — pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/budget/frequency.ts src/features/budget/RecurringPage.tsx src/features/budget/DashboardPage.tsx src/features/budget/__tests__/DashboardPage.test.tsx
git commit -m "feat(frontend): dashboard upcoming-recurring widget, shared frequency labels"
```

---

### Task 5: Recent transactions widget

**Files:**
- Modify: `frontend/src/features/budget/DashboardPage.tsx`
- Test: `frontend/src/features/budget/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useTransactions(spaceId, { month: currentMonth() })`; `Category`/`Transaction` types.
- Produces: rows tagged `data-testid="recent-row"`; full-width card below the two-column grid.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('DashboardPage', ...)`:

```tsx
  it('lists recent transactions capped at 6 with income marked green-plus', async () => {
    /** Eight transactions are mocked; only the first 6 render (server order), Salary shows a + prefix. */
    const tx = (id: number, category: number, amount: string, date: string) => ({
      id,
      space: 1,
      category,
      amount,
      date,
      paid_by: 1,
      notes: id === 1 ? 'weekly shop' : '',
      created_by: 1,
      created_at: `${date}T10:00:00Z`,
    })
    server.use(
      http.get(`${BASE}/api/budgets/transactions/`, () =>
        HttpResponse.json([
          tx(1, 1, '84.20', '2026-07-08'),
          tx(2, 3, '2400.00', '2026-07-07'),
          tx(3, 2, '32.50', '2026-07-06'),
          tx(4, 1, '15.00', '2026-07-05'),
          tx(5, 1, '22.10', '2026-07-04'),
          tx(6, 2, '18.75', '2026-07-03'),
          tx(7, 1, '9.99', '2026-07-02'),
          tx(8, 1, '5.00', '2026-07-01'),
        ])
      )
    )
    renderPage()
    const rows = await screen.findAllByTestId('recent-row')
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('🛒 Groceries')
    expect(rows[0]).toHaveTextContent('weekly shop')
    expect(rows[1]).toHaveTextContent('+$2,400.00')
  })

  it('shows an empty message when the month has no transactions', async () => {
    /** With an empty transactions list, the recent card shows its empty state linking to the transactions page. */
    server.use(http.get(`${BASE}/api/budgets/transactions/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/no transactions this month yet/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: the two new tests FAIL (no `recent-row` testid); previous 7 pass.

- [ ] **Step 3: Implement the widget**

In `DashboardPage.tsx`:

Extend imports: `useTransactions` and types `Category`, `Transaction` from `@/hooks/useBudget`; `cn` from `@/lib/utils`.

Add the component above `DashboardPage`:

```tsx
const RECENT_LIMIT = 6

function RecentTransactions({
  transactions,
  categories,
  currency,
  locale,
}: {
  transactions: Transaction[]
  categories: Category[]
  currency: string
  locale: string
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const recent = transactions.slice(0, RECENT_LIMIT)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Recent transactions
        </CardTitle>
        <Link to="/budget/transactions" className="text-xs font-medium text-primary hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions this month yet.{' '}
            <Link to="/budget/transactions" className="text-primary hover:underline">
              Add one
            </Link>
          </p>
        ) : (
          recent.map((t) => {
            const category = categoryById.get(t.category)
            const isIncome = category?.is_income ?? false
            return (
              <div key={t.id} data-testid="recent-row" className="flex items-center justify-between py-1 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{category ? `${category.icon} ${category.name}` : '—'}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDayHeading(t.date, locale)}
                    {t.notes ? ` · ${t.notes}` : ''}
                  </span>
                </span>
                <span className={cn('font-semibold', isIncome && 'text-green-600 dark:text-green-400')}>
                  {isIncome ? '+' : ''}
                  {formatMoney(t.amount, currency, locale)}
                </span>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
```

In `DashboardPage` add the hook call:

```tsx
  const { data: transactions = [] } = useTransactions(space?.id ?? null, { month: currentMonth() })
```

and render `<RecentTransactions transactions={transactions} categories={categories} currency={space.currency} locale={locale} />` after the two-column grid, still inside the non-loading branch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run src/features/budget/__tests__/DashboardPage.test.tsx`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/budget/DashboardPage.tsx src/features/budget/__tests__/DashboardPage.test.tsx
git commit -m "feat(frontend): dashboard recent-transactions widget"
```

---

### Task 6: Full verification, lint, roadmap update

**Files:**
- Modify: `docs/ROADMAP.md` (phase table + "Next up" list)

**Interfaces:**
- Consumes: everything above.
- Produces: green suites, clean lint/format, updated roadmap.

- [ ] **Step 1: Run the full frontend suite**

Run: `pnpm test --run`
Expected: all tests pass (including ReportsPage, RecurringPage, TransactionsPage suites touched by the extractions).

- [ ] **Step 2: Lint and format**

Run: `pnpm lint:fix && pnpm format`
Expected: no errors; re-run `pnpm test --run` if files changed.

- [ ] **Step 3: Verify in the running app**

Follow the project run flow (backend `runserver` + `pnpm dev`), open `http://localhost:5173/dashboard`, and confirm: tiles show numbers, Month/Year toggle changes them, all four cards render, links navigate.

- [ ] **Step 4: Update the roadmap**

In `docs/ROADMAP.md`: add to the phase table:

```markdown
| Dashboard page — summary tiles, top categories, upcoming recurring, recent transactions | [2026-07-09 dashboard design](superpowers/specs/2026-07-09-dashboard-page-design.md) | 2026-07 |
```

and delete the `- **Dashboard page** — ...` bullet from "Next up (no spec yet)".

- [ ] **Step 5: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: record dashboard page phase in roadmap"
```
