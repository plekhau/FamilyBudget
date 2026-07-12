/**
 * Emoji + name pair for a category. Emoji glyphs fill their em-box, so a plain
 * space between them and the name looks flush — the icon span carries an extra
 * margin, while the text content stays "icon name" for copy-paste and queries.
 */
export function CategoryLabel({ icon, name }: { icon?: string; name: string }) {
  return (
    <span data-slot="category-label" className="truncate">
      {icon && (
        <span aria-hidden="true" className="mr-1">
          {icon}
        </span>
      )}
      {icon ? ' ' : ''}
      {name}
    </span>
  )
}
