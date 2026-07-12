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
import { findCategoryLabel } from '@/test-utils'

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

  it('shows a page title like the other budget pages', async () => {
    /** Every budget page opens with an h1 + subtitle; Reports should match. */
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: /reports/i })).toBeInTheDocument()
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
    expect(await findCategoryLabel('🛒 Groceries')).toBeInTheDocument()
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
    await findCategoryLabel('🛒 Groceries')
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
    await findCategoryLabel('🛒 Groceries')
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

  it('shows a Today button only when off the current period', async () => {
    /** Hidden initially; appears after stepping back; clicking resets the period. */
    renderPage()
    await findCategoryLabel('🛒 Groceries')
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /previous period/i }))
    await userEvent.click(await screen.findByRole('button', { name: /today/i }))
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
  })

  it('sorts the expense legend by amount descending with color swatches', async () => {
    /** Legend order follows totals (Groceries 84.20 before Dining Out 32.50) and each row has a swatch. */
    renderPage()
    await screen.findByText(/expenses by category/i)
    const rows = screen.getAllByTestId('legend-row')
    expect(rows[0]).toHaveTextContent('Groceries')
    expect(rows[1]).toHaveTextContent('Dining Out')
    const swatches = screen.getAllByTestId('legend-swatch')
    expect(swatches).toHaveLength(rows.length)
    expect(swatches[0]).toHaveStyle({ backgroundColor: '#6366f1' })
  })

  it('groups categories beyond twelve into a gray Other slice', async () => {
    /** With 14 expense categories, legend rows 12+ carry the reserved gray swatch. */
    const manyCategories = Array.from({ length: 14 }, (_, i) => ({
      id: i + 10,
      name: `Cat ${i + 1}`,
      icon: '🔖',
      is_income: false,
    }))
    const manyRows = manyCategories.map((c, i) => ({
      category_id: c.id,
      category_name: c.name,
      category_icon: c.icon,
      total: String(1400 - i * 100),
    }))
    server.use(
      http.get(`${BASE}/api/budgets/categories/`, () => HttpResponse.json(manyCategories)),
      http.get(`${BASE}/api/budgets/reports/:reportType/`, () => HttpResponse.json(manyRows))
    )
    renderPage()
    await screen.findByText(/expenses by category/i)
    const swatches = screen.getAllByTestId('legend-swatch')
    expect(swatches).toHaveLength(14)
    expect(swatches[10]).not.toHaveStyle({ backgroundColor: '#9ca3af' })
    expect(swatches[11]).toHaveStyle({ backgroundColor: '#9ca3af' })
    expect(swatches[13]).toHaveStyle({ backgroundColor: '#9ca3af' })
  })

  it('lays the summary cards out as a responsive grid', async () => {
    /** The cards container uses grid-cols-1 sm:grid-cols-3. */
    renderPage()
    await screen.findByText(/expenses by category/i)
    const grid = screen.getByTestId('summary-cards')
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-3')
  })
})
