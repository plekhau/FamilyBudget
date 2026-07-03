import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { CreateSpaceModal } from '../CreateSpaceModal'
import * as currencies from '@/lib/currencies'

const BASE = 'http://localhost:8000'

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CreateSpaceModal open onClose={() => {}} /> {/* eslint-disable-line @typescript-eslint/no-empty-function */}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CreateSpaceModal currency', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pre-selects the currency guessed from the browser locale', async () => {
    /** The currency select defaults to the locale-derived code. */
    vi.spyOn(currencies, 'defaultCurrencyForLocale').mockReturnValue('EUR')
    renderModal()
    expect(screen.getByLabelText(/currency/i)).toHaveValue('EUR')
  })

  it('sends the chosen currency when creating a space', async () => {
    /** Changing the select changes the POST /api/spaces/ payload. */
    let posted: { name?: string; currency?: string } = {}
    server.use(
      http.post(`${BASE}/api/spaces/`, async ({ request }) => {
        posted = (await request.json()) as typeof posted
        return HttpResponse.json(
          { id: 5, name: posted.name, currency: posted.currency, created_at: '2026-01-01T00:00:00Z', members: [] },
          { status: 201 }
        )
      })
    )
    renderModal()
    await userEvent.type(screen.getByLabelText(/space name/i), 'Euro Home')
    await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'PLN')
    await userEvent.click(screen.getByRole('button', { name: /create space/i }))
    await waitFor(() => expect(posted).toEqual({ name: 'Euro Home', currency: 'PLN' }))
  })

  it('shows symbol-first labels without ISO codes', () => {
    /** Options read like "€ Euro" — the ISO code is not user-visible text. */
    renderModal()
    expect(screen.getByRole('option', { name: '€ Euro' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /EUR/ })).not.toBeInTheDocument()
  })
})
