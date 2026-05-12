import { render, screen } from '@testing-library/react'
import { AvatarInitials } from '../avatar-initials'

describe('AvatarInitials', () => {
  it('renders the first letter of the name uppercased', () => {
    render(<AvatarInitials name="alex" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders ? when name is empty', () => {
    render(<AvatarInitials name="" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies sm size classes by default', () => {
    render(<AvatarInitials name="Alex" />)
    expect(screen.getByText('A')).toHaveClass('h-8', 'w-8')
  })

  it('applies md size classes when size is md', () => {
    render(<AvatarInitials name="Alex" size="md" />)
    expect(screen.getByText('A')).toHaveClass('h-10', 'w-10')
  })
})
