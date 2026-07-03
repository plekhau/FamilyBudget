import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { mockCategories } from '@/mocks/handlers'
import { TransactionDialog } from '../TransactionDialog'
import { setLastCategoryId } from '../lastCategory'
import { useAuthStore } from '@/store/authStore'
import type { Space } from '@/hooks/useSpaces'
import type { Transaction } from '@/hooks/useBudget'

const BASE = 'http://localhost:8000'

const space: Space = {
  id: 1,
  name: 'Home Budget',
  currency: 'USD',
  created_at: '2026-01-01T00:00:00Z',
  members: [
    {
      id: 1,
      user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
      role: 'owner',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      user: { id: 2, email: 'other@example.com', display_name: 'Other User' },
      role: 'member',
      joined_at: '2026-01-02T00:00:00Z',
    },
  ],
}

const existing: Transaction = {
  id: 7,
  space: 1,
  category: 2,
  amount: '32.50',
  date: '2026-05-14',
  paid_by: 2,
  notes: 'Pizza night',
  created_by: 2,
  created_at: '2026-05-14T19:00:00Z',
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function renderDialog(transaction: Transaction | null = null, onClose = () => {}) {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TransactionDialog open transaction={transaction} space={space} categories={mockCategories} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TransactionDialog', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    localStorage.clear()
  })

  it('defaults date to today and payer to the current user', () => {
    /** Add mode pre-fills date=today and paid_by=current user. */
    renderDialog()
    const today = new Date().toISOString().slice(0, 10)
    expect(screen.getByLabelText(/date/i)).toHaveValue(today)
    expect(screen.getByLabelText(/paid by/i)).toHaveValue('1')
  })

  it('defaults category to the last used one for this space', () => {
    /** The category select restores the persisted last-used category. */
    setLastCategoryId(1, 2)
    renderDialog()
    expect(screen.getByLabelText(/category/i)).toHaveValue('2')
  })

  it('rejects an invalid amount', async () => {
    /** Submitting a non-numeric amount shows a validation error and does not POST. */
    renderDialog()
    await userEvent.type(screen.getByLabelText(/amount/i), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/enter a positive amount/i)).toBeInTheDocument()
  })

  it('creates a transaction and remembers the category', async () => {
    /** A valid submit POSTs the payload and persists the chosen category as last-used. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/transactions/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 9, ...posted }, { status: 201 })
      })
    )
    const onClose = vi.fn()
    renderDialog(null, onClose)
    await userEvent.type(screen.getByLabelText(/amount/i), '12.30')
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '2')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posted.amount).toBe('12.30')
    expect(posted.category).toBe(2)
    expect(posted.space_id).toBe(1)
    expect(localStorage.getItem('lastCategory:1')).toBe('2')
  })

  it('pre-fills fields and PATCHes in edit mode', async () => {
    /** Edit mode shows the transaction values and saves via PATCH. */
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${BASE}/api/budgets/transactions/:id/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 7, ...patched })
      })
    )
    const onClose = vi.fn()
    renderDialog(existing, onClose)
    expect(screen.getByLabelText(/amount/i)).toHaveValue('32.50')
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Pizza night')
    await userEvent.clear(screen.getByLabelText(/amount/i))
    await userEvent.type(screen.getByLabelText(/amount/i), '40.00')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(patched.amount).toBe('40.00')
  })

  it('deletes after inline confirmation in edit mode', async () => {
    /** Delete requires a second confirming click, then DELETEs and closes. */
    let deleted = false
    server.use(
      http.delete(`${BASE}/api/budgets/transactions/:id/`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    const onClose = vi.fn()
    renderDialog(existing, onClose)
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleted).toBe(true)
  })
})
