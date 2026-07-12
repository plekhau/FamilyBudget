import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NoSpaceState } from '../NoSpaceState'

describe('NoSpaceState', () => {
  it('explains the requirement and links to the spaces page', () => {
    /** The empty state points the user at /spaces to create a space. */
    render(
      <MemoryRouter>
        <NoSpaceState />
      </MemoryRouter>
    )
    expect(screen.getByText(/create a space to start tracking your budget/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to spaces/i })).toHaveAttribute('href', '/spaces')
  })

  it('greets the first-time user with a welcome heading', () => {
    /** First-run screen should feel like a welcome, not a bare requirement. */
    render(
      <MemoryRouter>
        <NoSpaceState />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /welcome to familybudget/i })).toBeInTheDocument()
    expect(screen.getByText(/shared budget for your household/i)).toBeInTheDocument()
  })
})
