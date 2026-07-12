import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MobileDrawer } from '../MobileDrawer'

function renderDrawer(path = '/budget/transactions') {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <MobileDrawer open onClose={vi.fn()} />
      </MemoryRouter>
    </TooltipProvider>
  )
}

describe('MobileDrawer', () => {
  it('shows visible labels on the primary nav items', () => {
    /** On touch screens there are no tooltips, so icon-only nav would be a guessing game. */
    renderDrawer()
    for (const label of ['Dashboard', 'Budget', 'Spaces', 'Settings']) {
      expect(screen.getByRole('link', { name: label })).toHaveTextContent(label)
    }
  })

  it('still shows the section sub-navigation links', () => {
    /** The budget section links stay reachable from the drawer. */
    renderDrawer()
    expect(screen.getByRole('link', { name: 'Transactions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument()
  })
})
