import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { mockReport } from '@/mocks/handlers'
import { ReportsPage } from '../ReportsPage'
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
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReportsPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('computes income, expenses and net by joining categories', async () => {
    /** Salary (income) 2400 vs Groceries+Dining 116.70 → net +2,283.30. */
    renderPage()
    expect(await screen.findByText('$2,400.00')).toBeInTheDocument()
    expect(screen.getByText('$116.70')).toBeInTheDocument()
    expect(screen.getByText('+$2,283.30')).toBeInTheDocument()
  })

  it('lists expense categories with percentage share', async () => {
    /** Groceries is 84.20 of 116.70 ≈ 72%. */
    renderPage()
    expect(await screen.findByText(/🛒 Groceries/)).toBeInTheDocument()
    expect(screen.getByText(/72%/)).toBeInTheDocument()
  })

  it('defaults to the monthly report', async () => {
    /** On load the month endpoint is called. */
    let url = ''
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, ({ request }) => {
        url = request.url
        return HttpResponse.json(mockReport)
      })
    )
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    expect(url).toContain('monthly-summary')
  })

  it('switches to the weekly report via tabs', async () => {
    /** Clicking Week hits weekly-summary with a week param. */
    const urls: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json(mockReport)
      })
    )
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    await userEvent.click(screen.getByRole('tab', { name: /week/i }))
    await waitFor(() => expect(urls.some((u) => u.includes('weekly-summary'))).toBe(true))
    expect(urls[urls.length - 1]).toMatch(/week=\d{4}-\d{2}-\d{2}/)
  })

  it('shows an empty state when the period has no data', async () => {
    /** An empty report renders the no-data message. */
    server.use(http.get(`${BASE}/api/budgets/reports/:reportType/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/no data for this period/i)).toBeInTheDocument()
  })
})
