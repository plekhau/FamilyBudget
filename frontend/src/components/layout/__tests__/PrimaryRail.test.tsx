import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PrimaryRail } from '../PrimaryRail'

function renderRail(props?: { showLabels?: boolean }) {
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <PrimaryRail {...props} />
      </MemoryRouter>
    </TooltipProvider>
  )
}

describe('PrimaryRail', () => {
  it('renders a nav with w-16 width class', () => {
    const { container } = renderRail()
    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('w-16')
  })

  it('renders nav link buttons sized h-10 w-10 with flex centering', () => {
    const { container } = renderRail()
    const links = container.querySelectorAll('nav a')
    links.forEach((link) => {
      expect(link).toHaveClass('flex', 'h-10', 'w-10', 'items-center', 'justify-center')
    })
  })

  it('renders icons sized h-6 w-6', () => {
    const { container } = renderRail()
    const icons = container.querySelectorAll('nav a svg')
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach((icon) => {
      expect(icon).toHaveClass('h-6', 'w-6')
    })
  })

  it('shows visible text labels next to icons when showLabels is set', () => {
    /** The mobile drawer uses this mode so nav items are not icon-only guesses. */
    renderRail({ showLabels: true })
    for (const label of ['Dashboard', 'Budget', 'Spaces', 'Settings']) {
      expect(screen.getByRole('link', { name: label })).toHaveTextContent(label)
    }
  })

  it('keeps the icon-only w-16 rail by default', () => {
    /** Desktop keeps the slim rail; labels there live in tooltips. */
    const { container } = renderRail()
    expect(container.querySelector('nav')).toHaveClass('w-16')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveTextContent('Dashboard')
  })
})
