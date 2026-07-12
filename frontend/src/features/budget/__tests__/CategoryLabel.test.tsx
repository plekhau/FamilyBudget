import { render, screen } from '@testing-library/react'
import { CategoryLabel } from '../CategoryLabel'

describe('CategoryLabel', () => {
  it('renders the icon and name as a single "icon name" text', () => {
    /** Text content stays "🛒 Groceries" so toHaveTextContent checks and copy-paste read naturally. */
    const { container } = render(<CategoryLabel icon="🛒" name="Groceries" />)
    expect(container.querySelector('[data-slot="category-label"]')).toHaveTextContent('🛒 Groceries')
  })

  it('hides the emoji from assistive technology', () => {
    /** The emoji is decorative; screen readers should announce only the name. */
    const { container } = render(<CategoryLabel icon="🛒" name="Groceries" />)
    const iconSpan = container.querySelector('[aria-hidden="true"]')
    expect(iconSpan).toHaveTextContent('🛒')
  })

  it('adds a margin class to visually separate emoji from name', () => {
    /** Emoji glyphs fill their em-box, so a plain space looks flush; the span carries a margin. */
    const { container } = render(<CategoryLabel icon="🛒" name="Groceries" />)
    const iconSpan = container.querySelector('[aria-hidden="true"]')
    expect(iconSpan?.className).toMatch(/mr-/)
  })

  it('renders just the name when there is no icon', () => {
    /** Recurring rows can reference a deleted category, leaving icon undefined. */
    const { container } = render(<CategoryLabel name="Rent" />)
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument()
  })
})
