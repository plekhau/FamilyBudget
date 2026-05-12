import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { AcceptInvitePage } from '../AcceptInvitePage'
import { useAuthStore } from '@/store/authStore'

const BASE = 'http://localhost:8000'

function renderAcceptInvite(token?: string) {
  const url = token ? `/invite?token=${token}` : '/invite'
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/invite" element={<AcceptInvitePage />} />
          <Route path="/spaces" element={<div>Spaces Page</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    })
  })

  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
  })

  it('shows error when no token in URL', () => {
    renderAcceptInvite()
    expect(screen.getByText(/invalid invite link/i)).toBeInTheDocument()
  })

  it('shows the accept button when authenticated with a token', async () => {
    renderAcceptInvite('abc123')
    expect(await screen.findByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
  })

  it('redirects to /spaces on successful accept', async () => {
    renderAcceptInvite('abc123')
    await userEvent.click(await screen.findByRole('button', { name: /accept invitation/i }))
    expect(await screen.findByText('Spaces Page')).toBeInTheDocument()
  })

  it('shows error on 400 (invalid or expired token)', async () => {
    server.use(
      http.post(`${BASE}/api/spaces/invites/accept/`, () =>
        HttpResponse.json({ detail: 'Invalid or expired invite.' }, { status: 400 })
      )
    )
    renderAcceptInvite('bad-token')
    await userEvent.click(await screen.findByRole('button', { name: /accept invitation/i }))
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('redirects unauthenticated users to the login page', async () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    renderAcceptInvite('abc123')
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })
})
