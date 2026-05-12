import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import type { AxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { useAcceptInvite } from '@/hooks/useSpaces'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const acceptInvite = useAcceptInvite()

  useEffect(() => {
    if (!user && token) {
      navigate(`/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`, { replace: true })
    }
  }, [user, token, navigate])

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Invalid invite link</CardTitle>
            <CardDescription>This invite link is missing or malformed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!user) return null

  const errorMessage = (() => {
    if (!acceptInvite.error) return null
    const err = acceptInvite.error as AxiosError<{ detail: string }>
    if (err.response?.status === 403) return 'This invite was sent to a different email address.'
    return 'This invite link is invalid or has expired.'
  })()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>You&apos;ve been invited</CardTitle>
          <CardDescription>Accept the invitation to join a shared budget space.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <Button className="w-full" onClick={() => acceptInvite.mutate(token)} disabled={acceptInvite.isPending}>
            {acceptInvite.isPending ? 'Joining…' : 'Accept Invitation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
