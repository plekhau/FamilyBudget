import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { mockTransactions } from '@/mocks/handlers'
import { TransactionsPage } from '../TransactionsPage'
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
        <TransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TransactionsPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('renders transactions grouped by day with payer names', async () => {
    /** Rows show category icon+name, payer display name from space members, day headings. */
    renderPage()
    expect(await screen.findByText(/🛒 Groceries/)).toBeInTheDocument()
    expect(screen.getByText(/Thu, May 14/)).toBeInTheDocument()
    expect(screen.getByText(/Tue, May 12/)).toBeInTheDocument()
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0)
    expect(screen.getByText('Other User')).toBeInTheDocument()
  })

  it('shows income green with a plus and the space currency symbol', async () => {
    /** The Salary row renders +$2,400.00 with the income style class. */
    renderPage()
    const incomeRow = await screen.findByText(/💰 Salary/)
    const income = incomeRow.closest('button')?.querySelector('.text-green-600')
    expect(income?.textContent).toBe('+$2,400.00')
    expect(screen.getByText('$84.20')).toBeInTheDocument()
  })

  it('refetches when stepping the month', async () => {
    /** The ‹ button changes the month param in the API call. */
    const months: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/transactions/`, ({ request }) => {
        months.push(new URL(request.url).searchParams.get('month') ?? '')
        return HttpResponse.json([])
      })
    )
    renderPage()
    await screen.findByText(/no transactions in/i)
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await waitFor(() => expect(months.length).toBeGreaterThanOrEqual(2))
    expect(months[0]).not.toBe(months[months.length - 1])
  })

  it('filters by category', async () => {
    /** Picking a category adds category_id to the API call. */
    const urls: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/transactions/`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json([])
      })
    )
    renderPage()
    await screen.findByText(/no transactions in/i)
    await userEvent.selectOptions(await screen.findByLabelText(/filter by category/i), '1')
    await waitFor(() => expect(urls[urls.length - 1]).toContain('category_id=1'))
  })

  it('opens the add dialog from the header button', async () => {
    /** "+ Add" opens TransactionDialog in add mode. */
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(await screen.findByText('Add transaction')).toBeInTheDocument()
  })

  it('opens the edit dialog when a row is clicked', async () => {
    /** Clicking a transaction row opens the dialog pre-filled. */
    renderPage()
    await userEvent.click(await screen.findByText(/🍽️ Dining Out/))
    expect(await screen.findByText('Edit transaction')).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toHaveValue('32.50')
  })

  it('shows the no-space state when the user has no spaces', async () => {
    /** Without any space the page shows the shared empty state. */
    server.use(http.get(`${BASE}/api/spaces/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/create a space to start tracking your budget/i)).toBeInTheDocument()
  })

  it('formats dates and money using the space locale', async () => {
    /** A space with locale de-DE renders German day headings. */
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
            currency: 'EUR',
            locale: 'de-DE',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 1,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'owner',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      ),
      http.get(`${BASE}/api/budgets/transactions/`, () => HttpResponse.json([mockTransactions[0]]))
    )
    renderPage()
    expect(await screen.findByText(/Mai/)).toBeInTheDocument()
  })

  it('shows the month summary strip with income, spent and net', async () => {
    /** The strip totals the fetched transactions: income green, net signed. */
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    const strip = screen.getByTestId('month-summary')
    expect(strip).toHaveTextContent('Income +$2,400.00')
    expect(strip).toHaveTextContent('Spent $116.70')
    expect(strip).toHaveTextContent('Net +$2,283.30')
  })

  it('shows a subtotal in each day heading', async () => {
    /** Expense days show the plain spent amount; income days show green +amount. */
    renderPage()
    const expenseDay = await screen.findByTestId('day-total-2026-05-14')
    expect(expenseDay).toHaveTextContent('$116.70')
    const incomeDay = screen.getByTestId('day-total-2026-05-12')
    expect(incomeDay).toHaveTextContent('+$2,400.00')
    expect(incomeDay).toHaveClass('text-green-600')
  })

  it('hides the summary strip when the month is empty', async () => {
    /** No transactions → no strip, just the empty state. */
    server.use(http.get(`${BASE}/api/budgets/transactions/`, () => HttpResponse.json([])))
    renderPage()
    await screen.findByText(/no transactions in/i)
    expect(screen.queryByTestId('month-summary')).not.toBeInTheDocument()
  })
})
