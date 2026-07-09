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
