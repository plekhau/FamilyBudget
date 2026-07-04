import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { RecurringPage } from '../RecurringPage'
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
        <RecurringPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RecurringPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('lists recurring transactions with amount, frequency and next date', async () => {
    /** The Rent template shows its amount, monthly frequency and next due date. */
    renderPage()
    expect(await screen.findByText(/Rent/)).toBeInTheDocument()
    expect(screen.getByText('$950.00')).toBeInTheDocument()
    expect(screen.getByText(/monthly/i)).toBeInTheDocument()
    expect(screen.getByText(/Aug 1/)).toBeInTheDocument()
  })

  it('toggles is_active from the row switch', async () => {
    /** Flipping the switch PATCHes is_active without opening the dialog. */
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${BASE}/api/budgets/recurring-transactions/:id/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 1, ...patched })
      })
    )
    renderPage()
    await screen.findByText(/Rent/)
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(patched).toEqual({ is_active: false }))
  })

  it('creates a recurring transaction with next_due_date equal to start_date', async () => {
    /** The add dialog POSTs next_due_date = start_date. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/recurring-transactions/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 99, ...posted }, { status: 201 })
      })
    )
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /add recurring/i }))
    await userEvent.type(screen.getByLabelText(/amount/i), '15.99')
    await userEvent.type(screen.getByLabelText(/description/i), 'Netflix')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(posted.description).toBe('Netflix'))
    expect(posted.next_due_date).toBe(posted.start_date)
    expect(posted.space_id).toBe(1)
  })

  it('opens the edit dialog from a row and deletes with confirmation', async () => {
    /** Clicking the row body opens edit mode; Delete → Confirm Delete removes it. */
    let deleted = false
    server.use(
      http.delete(`${BASE}/api/budgets/recurring-transactions/:id/`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    renderPage()
    await userEvent.click(await screen.findByText(/Rent/))
    expect(await screen.findByText('Edit recurring transaction')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('renders the frequency capitalized', async () => {
    /** "monthly" from the API renders as "Monthly". */
    renderPage()
    expect(await screen.findByText(/Monthly ·/)).toBeInTheDocument()
  })
})
