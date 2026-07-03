import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { CategoriesPage } from '../CategoriesPage'
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
        <CategoriesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CategoriesPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('splits categories into expense and income sections', async () => {
    /** Groceries/Dining Out sit under Expenses, Salary under Income. */
    renderPage()
    expect(await screen.findByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText(/Groceries/)).toBeInTheDocument()
    expect(screen.getByText(/Salary/)).toBeInTheDocument()
  })

  it('creates a category through the add dialog', async () => {
    /** The dialog POSTs name, icon and is_income. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/categories/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 99, ...posted }, { status: 201 })
      })
    )
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /add category/i }))
    await userEvent.type(screen.getByLabelText(/name/i), 'Pets')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(posted.name).toBe('Pets'))
    expect(posted.space_id).toBe(1)
    expect(posted.is_income).toBe(false)
  })

  it('edits a category through the pencil button', async () => {
    /** The edit dialog PATCHes the changed name. */
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${BASE}/api/budgets/categories/:id/`, async ({ request, params }) => {
        patched = { id: Number(params.id), ...((await request.json()) as Record<string, unknown>) }
        return HttpResponse.json(patched)
      })
    )
    renderPage()
    await screen.findByText(/Groceries/)
    await userEvent.click(screen.getByRole('button', { name: /edit groceries/i }))
    const nameInput = screen.getByLabelText(/name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Food')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(patched.name).toBe('Food'))
    expect(patched.id).toBe(1)
  })

  it('shows the backend detail message when delete returns 409', async () => {
    /** A protected category surfaces the 409 detail as an error toast. */
    server.use(
      http.delete(`${BASE}/api/budgets/categories/:id/`, () =>
        HttpResponse.json({ detail: 'This category has transactions and cannot be deleted.' }, { status: 409 })
      )
    )
    renderPage()
    await screen.findByText(/Groceries/)
    await userEvent.click(screen.getByRole('button', { name: /delete groceries/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    expect(await screen.findByText(/has transactions and cannot be deleted/i)).toBeInTheDocument()
  })
})
