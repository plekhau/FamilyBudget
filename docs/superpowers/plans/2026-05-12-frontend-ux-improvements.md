# Frontend UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, UX gaps, and spacing inconsistencies across auth/settings/spaces pages, and establish shared Avatar, Skeleton, and Toast patterns before budget pages are built.

**Architecture:** All changes are confined to `frontend/src/`. New shared components go in `components/ui/`. Three new shadcn components (Tooltip, DropdownMenu, Skeleton) and one new npm package (Sonner) are added. No backend changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Radix UI, Zustand, TanStack Query v5, Sonner, Vitest, React Testing Library, MSW v2.

---

## File Map

| File | Action | Reason |
|---|---|---|
| `frontend/src/components/ui/avatar-initials.tsx` | **Create** | Shared initials avatar |
| `frontend/src/components/ui/__tests__/avatar-initials.test.tsx` | **Create** | Tests for AvatarInitials |
| `frontend/src/components/ui/tooltip.tsx` | **Create** (shadcn) | Tooltip for PrimaryRail |
| `frontend/src/components/ui/dropdown-menu.tsx` | **Create** (shadcn) | Space switcher |
| `frontend/src/components/ui/skeleton.tsx` | **Create** (shadcn) | Loading state pattern |
| `frontend/src/main.tsx` | Modify | Add TooltipProvider, Toaster |
| `frontend/src/components/layout/PrimaryRail.tsx` | Modify | Wrap icons in Tooltip |
| `frontend/src/router/index.tsx` | Modify | Add stub budget routes |
| `frontend/src/features/auth/RegisterPage.tsx` | Modify | Remove noValidate from input; fix spacing |
| `frontend/src/features/auth/LoginPage.tsx` | Modify | Fix label-to-input spacing |
| `frontend/src/features/settings/SettingsPage.tsx` | Modify | Spacing, AvatarInitials, toast |
| `frontend/src/features/settings/__tests__/SettingsPage.test.tsx` | Modify | Add Toaster to renderSettings |
| `frontend/src/features/spaces/SpacesPage.tsx` | Modify | RoleBadge, AvatarInitials, dividers, spacing, skeleton, DropdownMenu switcher, Copied! |
| `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx` | Modify | Update switcher tests |
| `frontend/src/features/spaces/AcceptInvitePage.tsx` | Modify | Replace null return with skeleton |
| `frontend/src/features/spaces/CreateSpaceModal.tsx` | Modify | Fix label-to-input spacing |

---

## Task 1: Install dependencies

**Files:** none (package manifest changes only)

- [ ] **Step 1: Install Sonner**

Run from `frontend/`:
```bash
pnpm add sonner
```
Expected: sonner added to `package.json` dependencies.

- [ ] **Step 2: Add shadcn Tooltip, DropdownMenu, Skeleton**

Run from `frontend/`:
```bash
pnpm dlx shadcn@latest add tooltip
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add skeleton
```
Expected: three new files created in `frontend/src/components/ui/`: `tooltip.tsx`, `dropdown-menu.tsx`, `skeleton.tsx`.

- [ ] **Step 3: Verify the app still compiles**

```bash
pnpm --filter frontend typecheck 2>/dev/null || pnpm --dir frontend exec tsc --noEmit
```

Or just run the test suite to confirm nothing broke:
```bash
cd frontend && pnpm test --run
```
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/components/ui/tooltip.tsx frontend/src/components/ui/dropdown-menu.tsx frontend/src/components/ui/skeleton.tsx
git commit -m "chore(frontend): add shadcn tooltip, dropdown-menu, skeleton; install sonner"
```

---

## Task 2: AvatarInitials component (TDD)

**Files:**
- Create: `frontend/src/components/ui/avatar-initials.tsx`
- Create: `frontend/src/components/ui/__tests__/avatar-initials.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/ui/__tests__/avatar-initials.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm test --run src/components/ui/__tests__/avatar-initials.test.tsx
```
Expected: 4 failures — "Cannot find module '../avatar-initials'".

- [ ] **Step 3: Implement AvatarInitials**

Create `frontend/src/components/ui/avatar-initials.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm test --run src/components/ui/__tests__/avatar-initials.test.tsx
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/avatar-initials.tsx frontend/src/components/ui/__tests__/avatar-initials.test.tsx
git commit -m "feat(frontend): add AvatarInitials shared component"
```

---

## Task 3: Wire up global providers (TooltipProvider + Toaster)

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Update main.tsx**

Replace the entire contents of `frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { ThemeProvider } from './components/ThemeProvider'
import { TooltipProvider } from './components/ui/tooltip'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find root element')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <App />
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
cd frontend && pnpm test --run
```
Expected: all existing tests pass. (Tests render components directly without TooltipProvider, which is fine — Tooltip degrades gracefully without a provider in test renders.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "feat(frontend): add TooltipProvider and Sonner Toaster to app root"
```

---

## Task 4: PrimaryRail — add hover tooltips

**Files:**
- Modify: `frontend/src/components/layout/PrimaryRail.tsx`

- [ ] **Step 1: Update PrimaryRail.tsx**

Replace the entire file:

```tsx
import { NavLink } from 'react-router'
import { LayoutDashboard, Wallet, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const TOP_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { id: 'budget', icon: Wallet, label: 'Budget', to: '/budget' },
  { id: 'spaces', icon: Users, label: 'Spaces', to: '/spaces' },
]

const BOTTOM_ITEMS = [{ id: 'settings', icon: Settings, label: 'Settings', to: '/settings' }]

function RailIcon({ icon: Icon, label, to }: { icon: React.ElementType; label: string; to: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          aria-label={label}
          className={({ isActive }) =>
            cn(
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
        >
          <Icon className="h-4 w-4" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function PrimaryRail() {
  return (
    <nav className="flex w-14 flex-col items-center border-r border-border bg-card py-3">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        F
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {TOP_ITEMS.map((item) => (
          <RailIcon key={item.id} {...item} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {BOTTOM_ITEMS.map((item) => (
          <RailIcon key={item.id} {...item} />
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
cd frontend && pnpm test --run
```
Expected: all tests pass. (No PrimaryRail-specific tests exist; we verify nothing regressed.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/PrimaryRail.tsx
git commit -m "feat(frontend): add hover tooltips to PrimaryRail icons"
```

---

## Task 5: Bug fix — noValidate on input in RegisterPage + spacing

**Files:**
- Modify: `frontend/src/features/auth/RegisterPage.tsx`

- [ ] **Step 1: Remove the no-op noValidate attribute and fix label spacing**

In `frontend/src/features/auth/RegisterPage.tsx`, replace the file with the corrected version. Two changes: remove `noValidate` from the `<Input>` on the email field (line 52), and change all `space-y-1` field group divs to `space-y-2`, and `space-y-4` form spacing to `space-y-5`:

```tsx
import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRegister } from '@/hooks/useAuth'

const schema = z
  .object({
    display_name: z.string().min(1, 'Display name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })
  const registerMutation = useRegister()

  const onSubmit = ({ display_name, email, password }: FormData) => {
    registerMutation.mutate({ display_name, email, password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">FamilyBudget</CardTitle>
          <CardDescription>Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" placeholder="Alex Smith" {...register('display_name')} />
              {errors.display_name && <p className="text-sm text-destructive">{errors.display_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input id="confirm_password" type="password" placeholder="••••••••" {...register('confirm_password')} />
              {errors.confirm_password && <p className="text-sm text-destructive">{errors.confirm_password.message}</p>}
            </div>
            {registerMutation.isError && (
              <p className="text-sm text-destructive">Registration failed. Please try again.</p>
            )}
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Run RegisterPage tests**

```bash
cd frontend && pnpm test --run src/features/auth/__tests__/RegisterPage.test.tsx
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/auth/RegisterPage.tsx
git commit -m "fix(frontend): remove no-op noValidate from input; improve form spacing"
```

---

## Task 6: Bug fix — AcceptInvitePage blank flash

**Files:**
- Modify: `frontend/src/features/spaces/AcceptInvitePage.tsx`

- [ ] **Step 1: Replace the null return with a Skeleton card**

Replace `frontend/src/features/spaces/AcceptInvitePage.tsx`:

```tsx
import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Skeleton className="h-40 w-80 rounded-xl" />
      </div>
    )
  }

  const errorMessage = acceptInvite.error ? 'This invite link is invalid or has expired.' : null

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
```

- [ ] **Step 2: Run AcceptInvitePage tests**

```bash
cd frontend && pnpm test --run src/features/spaces/__tests__/AcceptInvitePage.test.tsx
```
Expected: all 5 tests pass. The "redirects unauthenticated users to login" test still passes because `findByText('Login Page')` waits for the `useEffect` redirect to fire.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/spaces/AcceptInvitePage.tsx
git commit -m "fix(frontend): show skeleton instead of blank screen while redirecting to login"
```

---

## Task 7: Add stub budget routes

**Files:**
- Modify: `frontend/src/router/index.tsx`

- [ ] **Step 1: Add ComingSoon stubs and budget routes**

Replace `frontend/src/router/index.tsx`:

```tsx
/* eslint-disable react-refresh/only-export-components -- router files mix components and config by design */
import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { PrivateRoute } from './PrivateRoute'
import { AppShell } from '@/components/layout/AppShell'

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const SpacesPage = lazy(() => import('@/features/spaces/SpacesPage').then((m) => ({ default: m.SpacesPage })))
const AcceptInvitePage = lazy(() =>
  import('@/features/spaces/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage }))
)

const Loader = () => <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {title} — coming soon
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<Loader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<Loader />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/invite',
    element: (
      <Suspense fallback={<Loader />}>
        <AcceptInvitePage />
      </Suspense>
    ),
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/settings" replace /> },
          { path: '/dashboard', element: <ComingSoon title="Dashboard" /> },
          { path: '/budget', element: <Navigate to="/budget/transactions" replace /> },
          { path: '/budget/transactions', element: <ComingSoon title="Transactions" /> },
          { path: '/budget/categories', element: <ComingSoon title="Categories" /> },
          { path: '/budget/recurring', element: <ComingSoon title="Recurring" /> },
          { path: '/budget/reports', element: <ComingSoon title="Reports" /> },
          {
            path: '/settings',
            element: (
              <Suspense fallback={<Loader />}>
                <SettingsPage />
              </Suspense>
            ),
          },
          {
            path: '/spaces',
            element: (
              <Suspense fallback={<Loader />}>
                <SpacesPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
])
```

- [ ] **Step 2: Run all tests**

```bash
cd frontend && pnpm test --run
```
Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/router/index.tsx
git commit -m "fix(frontend): add stub routes for budget sub-pages to prevent 404s"
```

---

## Task 8: SpacesPage — part 1 (RoleBadge, AvatarInitials, dividers, spacing, skeleton)

**Files:**
- Modify: `frontend/src/features/spaces/SpacesPage.tsx`

This task makes structural and visual changes but does not touch the space-switcher logic (that's Task 9). The existing tests should all still pass after this task.

- [ ] **Step 1: Write a failing test for the loading skeleton**

Add this test to `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx` inside the `describe('SpacesPage')` block, after the last existing test:

```tsx
import { delay } from 'msw'

// Add to existing imports at the top of the file:
// import { delay } from 'msw'

it('shows a loading skeleton while spaces are fetched', async () => {
  server.use(
    http.get(`${BASE}/api/spaces/`, async () => {
      await delay('infinite')
      return HttpResponse.json([])
    })
  )
  renderSpaces()
  expect(await screen.findByTestId('spaces-loading')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm test --run src/features/spaces/__tests__/SpacesPage.test.tsx
```
Expected: the new "shows a loading skeleton" test fails; all other tests pass.

- [ ] **Step 3: Rewrite SpacesPage.tsx with RoleBadge, AvatarInitials, dividers, spacing, and skeleton**

Replace `frontend/src/features/spaces/SpacesPage.tsx` with the following. **Note:** the switcher in this step still renders the native `<select>` — the DropdownMenu replacement is Task 9. This keeps the diff reviewable.

```tsx
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { cn } from '@/lib/utils'
import { useSpaces, useCreateInvite, useDeleteSpace, type Space, type SpaceMember } from '@/hooks/useSpaces'
import { useSpaceStore } from '@/store/spaceStore'
import { useAuthStore } from '@/store/authStore'
import { CreateSpaceModal } from './CreateSpaceModal'
import { Check } from 'lucide-react'

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
            <CardContent className="divide-y divide-border">
              {selectedSpace.members.map((member) => (
                <MemberRow key={member.id} member={member} currentUserId={currentUser?.id ?? -1} />
              ))}
            </CardContent>
          </Card>

          <InviteCard key={`invite-${selectedSpace.id}`} spaceId={selectedSpace.id} />

          {isOwner && <DangerZoneCard key={`danger-${selectedSpace.id}`} space={selectedSpace} />}
        </>
      ) : null}

      <CreateSpaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Run SpacesPage tests**

```bash
cd frontend && pnpm test --run src/features/spaces/__tests__/SpacesPage.test.tsx
```
Expected: all tests pass including the new "shows a loading skeleton" test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/spaces/SpacesPage.tsx frontend/src/features/spaces/__tests__/SpacesPage.test.tsx
git commit -m "feat(frontend): extract RoleBadge, use AvatarInitials, add member dividers, skeleton loading"
```

---

## Task 9: SpacesPage — DropdownMenu space switcher + remove floating h2

**Files:**
- Modify: `frontend/src/features/spaces/SpacesPage.tsx`
- Modify: `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx`

- [ ] **Step 1: Update the failing tests first**

In `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx`, update the three tests that reference the native `<select>` or the `<h2>` heading:

```tsx
// Replace this test:
it('does not show the space switcher when only one space', async () => {
  renderSpaces()
  await screen.findByText('Home Budget')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
})

// With:
it('does not show the space switcher when only one space', async () => {
  renderSpaces()
  await screen.findByText('Home Budget')
  expect(screen.queryByRole('button', { name: /switch space/i })).not.toBeInTheDocument()
})

// Replace this test:
it('shows the space switcher when multiple spaces exist', async () => {
  server.use(/* ... same MSW handler ... */)
  renderSpaces()
  expect(await screen.findByRole('combobox')).toBeInTheDocument()
})

// With:
it('shows the space switcher when multiple spaces exist', async () => {
  server.use(
    http.get(`${BASE}/api/spaces/`, () =>
      HttpResponse.json([
        {
          id: 1,
          name: 'Home Budget',
          created_at: '2026-01-01T00:00:00Z',
          members: [
            {
              id: 1,
              user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
              role: 'owner',
              joined_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
        {
          id: 2,
          name: 'Trip Fund',
          created_at: '2026-01-01T00:00:00Z',
          members: [
            {
              id: 2,
              user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
              role: 'member',
              joined_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ])
    )
  )
  renderSpaces()
  expect(await screen.findByRole('button', { name: /switch space/i })).toBeInTheDocument()
})

// Replace the switching spaces test:
it('switching spaces shows the new space and renders each section exactly once', async () => {
  server.use(
    http.get(`${BASE}/api/spaces/`, () =>
      HttpResponse.json([
        {
          id: 1,
          name: 'Home Budget',
          created_at: '2026-01-01T00:00:00Z',
          members: [
            {
              id: 1,
              user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
              role: 'owner',
              joined_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
        {
          id: 2,
          name: 'Trip Fund',
          created_at: '2026-01-01T00:00:00Z',
          members: [
            {
              id: 2,
              user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
              role: 'member',
              joined_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ])
    )
  )
  renderSpaces()
  await screen.findByRole('button', { name: /switch space/i })

  await userEvent.click(screen.getByRole('button', { name: /switch space/i }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /trip fund/i }))

  expect(await screen.findByText('Trip Fund')).toBeInTheDocument()
  expect(screen.queryByText('Home Budget')).not.toBeInTheDocument()
  expect(screen.getAllByText(/invite someone/i)).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests to verify the updated tests now fail**

```bash
cd frontend && pnpm test --run src/features/spaces/__tests__/SpacesPage.test.tsx
```
Expected: the three updated switcher tests fail; all others pass.

- [ ] **Step 3: Replace the native select with DropdownMenu and remove the floating h2**

In `frontend/src/features/spaces/SpacesPage.tsx`, make two surgical edits — **do not replace the whole file**. All helper components (`RoleBadge`, `MemberRow`, `InviteCard`, `DangerZoneCard`) are unchanged from Task 8.

**Edit 1 — add DropdownMenu imports** (add after the existing import block):

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
```

**Edit 2 — replace the `SpacesPage` export function** (everything from `export function SpacesPage()` to the end of the file):

```tsx
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

          {isOwner && <DangerZoneCard key={`danger-${selectedSpace.id}`} space={selectedSpace} />}
        </>
      ) : null}

      <CreateSpaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Run all SpacesPage tests**

```bash
cd frontend && pnpm test --run src/features/spaces/__tests__/SpacesPage.test.tsx
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/spaces/SpacesPage.tsx frontend/src/features/spaces/__tests__/SpacesPage.test.tsx
git commit -m "feat(frontend): replace native select with DropdownMenu; remove floating h2 space name"
```

---

## Task 10: SpacesPage — InviteCard "Copied!" feedback

The `InviteCard` component was already updated in Task 8 with the `handleCopy` and `copied` state. This task adds the test to verify it works.

**Files:**
- Modify: `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `SpacesPage.test.tsx` inside `describe('SpacesPage')`:

```tsx
it('shows "Copied!" after clicking the copy button', async () => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  renderSpaces()
  await userEvent.click(await screen.findByRole('button', { name: /generate link/i }))
  await screen.findByDisplayValue(/test-invite-token-uuid/)
  await userEvent.click(screen.getByRole('button', { name: /copy/i }))
  expect(await screen.findByText(/copied!/i)).toBeInTheDocument()
})
```

Also add `vi` to the imports at the top of the test file (Vitest makes `vi` global, but if it isn't imported explicitly in this file yet, add `import { vi } from 'vitest'`).

- [ ] **Step 2: Run to verify it passes**

The implementation already exists from Task 8. This test should pass immediately:

```bash
cd frontend && pnpm test --run src/features/spaces/__tests__/SpacesPage.test.tsx
```
Expected: all tests pass including the new "Copied!" test.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/spaces/__tests__/SpacesPage.test.tsx
git commit -m "test(frontend): verify InviteCard shows Copied! feedback after clipboard write"
```

---

## Task 11: SettingsPage — spacing, AvatarInitials, toast

**Files:**
- Modify: `frontend/src/features/settings/SettingsPage.tsx`
- Modify: `frontend/src/features/settings/__tests__/SettingsPage.test.tsx`

- [ ] **Step 1: Update the renderSettings helper to include Toaster**

In `frontend/src/features/settings/__tests__/SettingsPage.test.tsx`, update `renderSettings()` to include `<Toaster />`:

```tsx
import { Toaster } from 'sonner'

function renderSettings() {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsPage />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Run SettingsPage tests to verify they still pass**

```bash
cd frontend && pnpm test --run src/features/settings/__tests__/SettingsPage.test.tsx
```
Expected: all 5 tests pass. (The `isSuccess` inline text is still there at this point.)

- [ ] **Step 3: Update SettingsPage.tsx**

Replace `frontend/src/features/settings/SettingsPage.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AvatarInitials } from '@/components/ui/avatar-initials'
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

  const onSubmit = (d: ProfileData) => {
    updateProfile.mutate(d, {
      onSuccess: () => toast.success('Saved successfully'),
      onError: () => toast.error('Failed to save. Please try again.'),
    })
  }

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
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <AvatarInitials name={displayName} size="md" />
            <div>
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" {...register('display_name')} />
              {errors.display_name && <p className="text-sm text-destructive">{errors.display_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled readOnly />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
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
```

- [ ] **Step 4: Run SettingsPage tests**

```bash
cd frontend && pnpm test --run src/features/settings/__tests__/SettingsPage.test.tsx
```
Expected: all 5 tests pass. The "saves a new display name" test still finds "Saved successfully" because `<Toaster />` is now in the render wrapper and Sonner renders the toast text into the DOM.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/settings/SettingsPage.tsx frontend/src/features/settings/__tests__/SettingsPage.test.tsx
git commit -m "feat(frontend): use AvatarInitials, Sonner toast, and improved spacing in SettingsPage"
```

---

## Task 12: Fix form spacing in LoginPage and CreateSpaceModal

**Files:**
- Modify: `frontend/src/features/auth/LoginPage.tsx`
- Modify: `frontend/src/features/spaces/CreateSpaceModal.tsx`

- [ ] **Step 1: Update LoginPage.tsx spacing**

In `frontend/src/features/auth/LoginPage.tsx`, change `space-y-4` on the form to `space-y-5`, and change both `space-y-1` field groups to `space-y-2`:

```tsx
import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLogin } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })
  const login = useLogin()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">FamilyBudget</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            {login.isError && <p className="text-sm text-destructive">Invalid credentials. Please try again.</p>}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Update CreateSpaceModal.tsx spacing**

In `frontend/src/features/spaces/CreateSpaceModal.tsx`, change `space-y-2` field group to `space-y-2` (already correct) — the only change is the form's `space-y-6` to `space-y-5` for consistency:

```tsx
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateSpace } from '@/hooks/useSpaces'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateSpaceModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const createSpace = useCreateSpace()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createSpace.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName('')
          onClose()
        },
      }
    )
  }

  const handleClose = () => {
    setName('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new space</DialogTitle>
          <DialogDescription>Spaces let you share a budget with your household or a group.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="space-name">Space name</Label>
            <Input
              id="space-name"
              placeholder="e.g. Home Budget"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {createSpace.isError && (
            <p className="text-sm text-destructive">Failed to create the space. Please try again.</p>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || createSpace.isPending} onClick={handleSubmit}>
            {createSpace.isPending ? 'Creating…' : 'Create Space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
cd frontend && pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 4: Lint and format**

```bash
cd frontend && pnpm lint:fix && pnpm format
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/auth/LoginPage.tsx frontend/src/features/spaces/CreateSpaceModal.tsx
git commit -m "fix(frontend): standardise form spacing — space-y-2 label/input, space-y-5 between groups"
```
