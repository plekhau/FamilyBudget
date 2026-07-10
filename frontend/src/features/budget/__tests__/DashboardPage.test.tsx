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

  it('lists top expense categories with percentages, capped at 5', async () => {
    /** Six expense categories are mocked; only the top 5 by total render, sorted descending, with % of expense total. */
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, () =>
        HttpResponse.json([
          { category_id: 1, category_name: 'Rent', category_icon: '🏠', total: '500.00' },
          { category_id: 2, category_name: 'Food', category_icon: '🍎', total: '250.00' },
          { category_id: 7, category_name: 'Fuel', category_icon: '⛽', total: '120.00' },
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

  it('shows a negative net with a minus sign and destructive styling', async () => {
    /** Groceries (expense) 3000.00 exceeds Salary (income) 1000.00, so net is -$2,000.00 in the destructive color. */
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, () =>
        HttpResponse.json([
          { category_id: 1, category_name: 'Groceries', category_icon: '🛒', total: '3000.00' },
          { category_id: 3, category_name: 'Salary', category_icon: '💰', total: '1000.00' },
        ])
      )
    )
    renderPage()
    const netTile = await screen.findByText('-$2,000.00')
    expect(netTile).toHaveClass('text-destructive')
  })
})
