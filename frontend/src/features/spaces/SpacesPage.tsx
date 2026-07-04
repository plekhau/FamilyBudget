import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { CURRENCIES } from '@/lib/currencies'
import { SUPPORTED_LOCALES } from '@/lib/locale'
import {
  useSpaces,
  useCreateInvite,
  useDeleteSpace,
  useUpdateSpace,
  type Space,
  type SpaceMember,
} from '@/hooks/useSpaces'
import { useSpaceStore } from '@/store/spaceStore'
import { useAuthStore } from '@/store/authStore'
import { CreateSpaceModal } from './CreateSpaceModal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        role === 'owner' && 'bg-primary/10 text-primary',
        role === 'admin' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        role === 'member' && 'bg-muted text-muted-foreground'
      )}
    >
      {role}
    </span>
  )
}

function MemberRow({ member, currentUserId }: { member: SpaceMember; currentUserId: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <AvatarInitials name={member.user.display_name} />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {member.user.display_name}
          {member.user.id === currentUserId && <span className="ml-1 text-muted-foreground">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground">{member.user.email}</p>
      </div>
      <RoleBadge role={member.role} />
    </div>
  )
}

function InviteCard({ spaceId }: { spaceId: number }) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const createInvite = useCreateInvite(spaceId)

  const handleGenerate = () => {
    createInvite.mutate(undefined, {
      onSuccess: (data) => {
        setInviteUrl(`${window.location.origin}/invite?token=${data.token}`)
      },
    })
  }

  const handleCopy = () => {
    if (!inviteUrl) return
    void navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Invite Someone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" onClick={handleGenerate} disabled={createInvite.isPending}>
          {createInvite.isPending ? 'Generating…' : 'Generate Link'}
        </Button>
        {inviteUrl && (
          <div className="space-y-2">
            <Label>Invite link</Label>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly />
              <Button type="button" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    Copied!
                  </span>
                ) : (
                  'Copy'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">This link expires in 7 days.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SpaceSettingsCard({ space }: { space: Space }) {
  const [currency, setCurrency] = useState(space.currency)
  const [locale, setLocale] = useState(space.locale)
  const updateSpace = useUpdateSpace()
  const dirty = currency !== space.currency || locale !== space.locale

  const handleSave = () => {
    updateSpace.mutate(
      { id: space.id, currency, locale },
      {
        onSuccess: () => toast.success('Space settings saved'),
        onError: () => toast.error('Failed to save space settings. Please try again.'),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Space Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-currency">Currency</Label>
            <NativeSelect id="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-locale">Formatting</Label>
            <NativeSelect id="settings-locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!dirty || updateSpace.isPending}>
          {updateSpace.isPending ? 'Saving…' : 'Save'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Changes how amounts and dates are displayed for everyone in this space. Existing amounts are not converted.
        </p>
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
        {deleteSpace.isError && (
          <p className="text-sm text-destructive">Failed to delete the space. Please try again.</p>
        )}
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
  const { data: spaces = [], isLoading } = useSpaces()
  const selectedSpaceId = useSpaceStore((s) => s.selectedSpaceId)
  const setSelectedSpaceId = useSpaceStore((s) => s.setSelectedSpaceId)
  const currentUser = useAuthStore((s) => s.user)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (spaces.length === 0) {
      setSelectedSpaceId(null)
      return
    }
    const valid = spaces.find((s) => s.id === selectedSpaceId)
    if (!valid) setSelectedSpaceId(spaces[0].id)
  }, [spaces, selectedSpaceId, setSelectedSpaceId])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" data-testid="spaces-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) ?? null
  const currentMembership = selectedSpace?.members.find((m) => m.user.id === currentUser?.id)
  const isOwner = currentMembership?.role === 'owner'
  const isOwnerOrAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Spaces</h1>
          <p className="text-sm text-muted-foreground">Manage your shared budget groups</p>
        </div>
        <div className="flex items-center gap-2">
          {spaces.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="switch space">
                  {selectedSpace?.name ?? 'Select space'}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {spaces.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => setSelectedSpaceId(s.id)}>
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : selectedSpace ? (
            <span className="text-sm font-medium">{selectedSpace.name}</span>
          ) : null}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Members · {selectedSpace.members.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {selectedSpace.members.map((member) => (
                <MemberRow key={member.id} member={member} currentUserId={currentUser?.id ?? -1} />
              ))}
            </CardContent>
          </Card>

          <InviteCard key={`invite-${selectedSpace.id}`} spaceId={selectedSpace.id} />

          {isOwnerOrAdmin && <SpaceSettingsCard key={`settings-${selectedSpace.id}`} space={selectedSpace} />}

          {isOwner && <DangerZoneCard key={`danger-${selectedSpace.id}`} space={selectedSpace} />}
        </>
      ) : null}

      <CreateSpaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
