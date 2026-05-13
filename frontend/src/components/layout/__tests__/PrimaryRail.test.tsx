import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PrimaryRail } from '../PrimaryRail'

function renderRail() {
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <PrimaryRail />
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

  it('renders nav link buttons sized h-10 w-10', () => {
    const { container } = renderRail()
    const links = container.querySelectorAll('nav a')
    links.forEach((link) => {
      expect(link).toHaveClass('h-10', 'w-10')
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
})
