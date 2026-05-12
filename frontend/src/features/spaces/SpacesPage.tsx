import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSpaces, useCreateInvite, useDeleteSpace, type Space, type SpaceMember } from '@/hooks/useSpaces'
import { useSpaceStore } from '@/store/spaceStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { CreateSpaceModal } from './CreateSpaceModal'

function MemberRow({ member, currentUserId }: { member: SpaceMember; currentUserId: number }) {
  const initials = member.user.display_name[0]?.toUpperCase() ?? '?'
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {initials}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">
          {member.user.display_name}
          {member.user.id === currentUserId && <span className="ml-1 text-muted-foreground">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground">{member.user.email}</p>
      </div>
      <span
        className={cn(
          'rounded px-1.5 py-0.5 text-xs font-medium',
          member.role === 'owner' && 'bg-primary/10 text-primary',
          member.role === 'admin' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          member.role === 'member' && 'bg-muted text-muted-foreground'
        )}
      >
        {member.role}
      </span>
    </div>
  )
}

function InviteCard({ spaceId }: { spaceId: number }) {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const createInvite = useCreateInvite(spaceId)

  const handleGenerate = () => {
    createInvite.mutate(
      { email: email || undefined },
      {
        onSuccess: (data) => {
          setInviteUrl(`${window.location.origin}/invite?token=${data.token}`)
          setEmail('')
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Invite Someone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Email address (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="button" onClick={handleGenerate} disabled={createInvite.isPending}>
            Generate Link
          </Button>
        </div>
        {inviteUrl && (
          <div className="space-y-1">
            <Label>Invite link</Label>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl)
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">This link expires in 7 days.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DangerZoneCard({ space }: { space: Space }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const deleteSpace = useDeleteSpace()

  if (!confirming) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-xs font-semibold tracking-wider text-destructive uppercase">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Delete Space
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-destructive uppercase">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Type <strong>{space.name}</strong> to confirm deletion. This cannot be undone.
        </p>
        <Input
          placeholder={`Type "${space.name}" to confirm`}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            variant="destructive"
            disabled={confirmName !== space.name || deleteSpace.isPending}
            onClick={() => deleteSpace.mutate(space.id)}
          >
            {deleteSpace.isPending ? 'Deleting…' : 'Confirm Delete'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirming(false)
              setConfirmName('')
            }}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SpacesPage() {
  const { data: spaces = [] } = useSpaces()
  const selectedSpaceId = useSpaceStore((s) => s.selectedSpaceId)
  const setSelectedSpaceId = useSpaceStore((s) => s.setSelectedSpaceId)
  const currentUser = useAuthStore((s) => s.user)
  const [modalOpen, setModalOpen] = useState(false)

  // Auto-select first space if none selected or selected space no longer accessible
  useEffect(() => {
    if (spaces.length === 0) {
      setSelectedSpaceId(null)
      return
    }
    const valid = spaces.find((s) => s.id === selectedSpaceId)
    if (!valid) setSelectedSpaceId(spaces[0].id)
  }, [spaces, selectedSpaceId, setSelectedSpaceId])

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) ?? null
  const currentMembership = selectedSpace?.members.find((m) => m.user.id === currentUser?.id)
  const isOwner = currentMembership?.role === 'owner'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Spaces</h1>
          <p className="text-sm text-muted-foreground">Manage your shared budget groups</p>
        </div>
        <div className="flex items-center gap-2">
          {spaces.length > 1 && (
            <select
              aria-label="Switch space"
              value={selectedSpaceId ?? ''}
              onChange={(e) => setSelectedSpaceId(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => setModalOpen(true)}>+ New Space</Button>
        </div>
      </div>

      {spaces.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">You don&apos;t have any spaces yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Spaces let you share a budget with your household or group.
            </p>
            <Button className="mt-4" onClick={() => setModalOpen(true)}>
              Create your first space
            </Button>
          </CardContent>
        </Card>
      ) : selectedSpace ? (
        <>
          <h2 className="text-lg font-semibold">{selectedSpace.name}</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Members · {selectedSpace.members.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedSpace.members.map((member) => (
                <MemberRow key={member.id} member={member} currentUserId={currentUser?.id ?? -1} />
              ))}
            </CardContent>
          </Card>

          <InviteCard key={selectedSpace.id} spaceId={selectedSpace.id} />

          {isOwner && <DangerZoneCard key={selectedSpace.id} space={selectedSpace} />}
        </>
      ) : null}

      <CreateSpaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
