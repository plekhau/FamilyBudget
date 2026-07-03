import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NoSpaceState() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Create a space to start tracking your budget.</p>
          <Button asChild className="mt-4">
            <Link to="/spaces">Go to Spaces</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
