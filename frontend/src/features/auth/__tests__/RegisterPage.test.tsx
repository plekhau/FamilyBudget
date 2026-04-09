import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RegisterPage } from '../RegisterPage'

function renderRegister() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RegisterPage', () => {
  it('shows validation error for an invalid email', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/email/i), 'notanemail')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('shows validation error when password is too short', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/^password$/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows validation error when passwords do not match', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/^password$/i), 'strongpass1')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'differentpass')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('has a link back to the login page', () => {
    renderRegister()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })
})
