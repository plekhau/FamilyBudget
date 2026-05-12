import { cn } from '@/lib/utils'

interface Props {
  name: string
  size?: 'sm' | 'md'
}

export function AvatarInitials({ name, size = 'sm' }: Props) {
  const initial = name[0]?.toUpperCase() ?? '?'
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
        size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
      )}
    >
      {initial}
    </div>
  )
}
