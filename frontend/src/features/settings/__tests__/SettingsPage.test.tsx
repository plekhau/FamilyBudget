import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from '../SettingsPage'
import { useAuthStore } from '@/store/authStore'

function renderSettings() {
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
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SettingsPage', () => {
  afterEach(() =>
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
  )

  it('displays the user email (read-only)', async () => {
    renderSettings()
    expect(await screen.findByDisplayValue('test@example.com')).toBeDisabled()
  })

  it('saves a new display name on form submit', async () => {
    renderSettings()
    const input = await screen.findByLabelText(/display name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText(/saved successfully/i)).toBeInTheDocument()
  })

  it('shows validation error when display name is cleared', async () => {
    renderSettings()
    const input = await screen.findByLabelText(/display name/i)
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument()
  })

  it('shows sign out button', async () => {
    renderSettings()
    expect(await screen.findByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('changes theme when a theme button is clicked', async () => {
    renderSettings()
    await userEvent.click(await screen.findByRole('button', { name: /dark/i }))
    const { theme } = (await import('@/store/themeStore')).useThemeStore.getState()
    expect(theme).toBe('dark')
  })
})
