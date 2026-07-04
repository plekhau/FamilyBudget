import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/mocks/server'
import { SpacesPage } from '../SpacesPage'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

const BASE = 'http://localhost:8000'

function renderSpaces() {
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
        <SpacesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SpacesPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('shows empty state when user has no spaces', async () => {
    server.use(http.get(`${BASE}/api/spaces/`, () => HttpResponse.json([])))
    renderSpaces()
    expect(await screen.findByText(/you don't have any spaces yet/i)).toBeInTheDocument()
  })

  it('shows space name and members for a single space', async () => {
    renderSpaces()
    expect(await screen.findByText('Home Budget')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Other User')).toBeInTheDocument()
  })

  it('does not show the space switcher when only one space', async () => {
    renderSpaces()
    await screen.findByText('Home Budget')
    expect(screen.queryByRole('button', { name: /switch space/i })).not.toBeInTheDocument()
  })

  it('shows the space switcher when multiple spaces exist', async () => {
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
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
          {
            id: 2,
            name: 'Trip Fund',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 2,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'member',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      )
    )
    renderSpaces()
    expect(await screen.findByRole('button', { name: /switch space/i })).toBeInTheDocument()
  })

  it('switching spaces shows the new space and renders each section exactly once', async () => {
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
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
          {
            id: 2,
            name: 'Trip Fund',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 2,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'member',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      )
    )
    renderSpaces()
    await screen.findByRole('button', { name: /switch space/i })

    await userEvent.click(screen.getByRole('button', { name: /switch space/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /trip fund/i }))

    expect(await screen.findByText('Trip Fund')).toBeInTheDocument()
    expect(screen.queryByText('Home Budget')).not.toBeInTheDocument()
    expect(screen.getAllByText(/invite someone/i)).toHaveLength(1)
  })

  it('opens the create space modal and closes it after creation', async () => {
    renderSpaces()
    await userEvent.click(await screen.findByRole('button', { name: /new space/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/space name/i), 'Trip Fund')
    await userEvent.click(screen.getByRole('button', { name: /create space/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('generates an invite link containing the token', async () => {
    renderSpaces()
    await userEvent.click(await screen.findByRole('button', { name: /generate link/i }))
    expect(await screen.findByDisplayValue(/test-invite-token-uuid/)).toBeInTheDocument()
  })

  it('shows the danger zone for an owner', async () => {
    renderSpaces()
    expect(await screen.findByRole('button', { name: /delete space/i })).toBeInTheDocument()
  })

  it('hides the danger zone for non-owner members', async () => {
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 1,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'member',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      )
    )
    renderSpaces()
    await screen.findByText('Home Budget')
    expect(screen.queryByRole('button', { name: /delete space/i })).not.toBeInTheDocument()
  })

  it('shows inline delete confirmation when Delete Space is clicked', async () => {
    renderSpaces()
    await userEvent.click(await screen.findByRole('button', { name: /delete space/i }))
    expect(await screen.findByPlaceholderText(/type.*home budget/i)).toBeInTheDocument()
  })

  it('shows a loading skeleton while spaces are fetched', async () => {
    server.use(
      http.get(`${BASE}/api/spaces/`, async () => {
        await delay('infinite')
        return HttpResponse.json([])
      })
    )
    renderSpaces()
    expect(await screen.findByTestId('spaces-loading')).toBeInTheDocument()
  })

  it('shows "Copied!" after clicking the copy button', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    renderSpaces()
    await userEvent.click(await screen.findByRole('button', { name: /generate link/i }))
    await screen.findByDisplayValue(/test-invite-token-uuid/)
    await userEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(await screen.findByText(/copied!/i)).toBeInTheDocument()
  })

  it('shows the space settings card to the owner', async () => {
    /** Owners see the Space Settings card with a currency select. */
    renderSpaces()
    await screen.findByText('Home Budget')
    expect(screen.getByText(/space settings/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
  })

  it('hides the space settings card from plain members', async () => {
    /** Members must not see the settings card. */
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
            currency: 'USD',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 1,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'member',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      )
    )
    renderSpaces()
    await screen.findByText('Home Budget')
    expect(screen.queryByText(/space settings/i)).not.toBeInTheDocument()
  })

  it('saves a currency change via PATCH', async () => {
    /** Picking a currency and clicking Save PATCHes the space. */
    let patched: { currency?: string; locale?: string } = {}
    server.use(
      http.patch(`${BASE}/api/spaces/:id/`, async ({ request }) => {
        patched = (await request.json()) as typeof patched
        return HttpResponse.json({
          id: 1,
          name: 'Home Budget',
          currency: patched.currency,
          locale: patched.locale ?? '',
          created_at: '2026-01-01T00:00:00Z',
          members: [],
        })
      })
    )
    renderSpaces()
    await screen.findByText('Home Budget')
    await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'EUR')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(patched).toMatchObject({ currency: 'EUR' }))
  })

  it('saves the formatting locale from space settings', async () => {
    /** Picking German in the Formatting select PATCHes locale=de-DE. */
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.patch(`${BASE}/api/spaces/:id/`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json({
          id: 1,
          name: 'Home Budget',
          currency: 'USD',
          locale: 'de-DE',
          created_at: '2026-01-01T00:00:00Z',
          members: [],
        })
      })
    )
    renderSpaces()
    await userEvent.selectOptions(await screen.findByLabelText(/formatting/i), 'de-DE')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(bodies[0]).toMatchObject({ locale: 'de-DE' }))
  })
})
