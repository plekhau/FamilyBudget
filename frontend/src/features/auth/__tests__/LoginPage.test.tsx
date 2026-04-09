import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { LoginPage } from '../LoginPage'

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  it('shows validation error for an invalid email', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'notanemail')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('shows validation error when password is empty', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
  })

  it('shows error message when credentials are rejected by the API', async () => {
    server.use(
      http.post('http://localhost:8000/api/auth/token/', () =>
        HttpResponse.json({ detail: 'No active account found' }, { status: 401 })
      )
    )
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
  })

  it('has a link to the register page', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register')
  })
})
