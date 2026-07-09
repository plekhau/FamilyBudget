import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function SummaryCard({ title, value, className }: { title: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4 sm:flex-col sm:justify-center sm:text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
        <p className={cn('text-lg font-bold sm:mt-1', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}
