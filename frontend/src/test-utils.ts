import { screen } from '@testing-library/react'

/**
 * Find a CategoryLabel by its full "icon name" text. The label splits the
 * emoji and name into separate spans, so plain text queries can't match the
 * combined string — this matcher checks the label's normalized textContent.
 */
export function findCategoryLabel(text: string): Promise<HTMLElement> {
  return screen.findByText(
    (_, el) =>
      el?.getAttribute('data-slot') === 'category-label' && (el.textContent ?? '').replace(/\s+/g, ' ').trim() === text
  )
}
