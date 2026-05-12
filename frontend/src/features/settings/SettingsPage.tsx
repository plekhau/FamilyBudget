import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMe, useUpdateProfile, useLogout } from '@/hooks/useAuth'
import { useThemeStore, type Theme } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  display_name: z.string().min(1, 'Display name is required'),
})
type ProfileData = z.infer<typeof profileSchema>

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsPage() {
  const { data: me } = useMe()
  const storeUser = useAuthStore((s) => s.user)
  const updateProfile = useUpdateProfile()
  const logout = useLogout()
  const { theme, setTheme } = useThemeStore()

  const displayName = me?.display_name ?? storeUser?.display_name ?? ''
  const email = me?.email ?? storeUser?.email ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    values: { display_name: displayName },
  })

  const initials = displayName[0]?.toUpperCase() ?? '?'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit((d) => updateProfile.mutate(d))} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" {...register('display_name')} />
              {errors.display_name && <p className="text-sm text-destructive">{errors.display_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled readOnly />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            {updateProfile.isSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">Saved successfully</p>
            )}
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  theme === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {logout.isPending ? 'Signing out…' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
