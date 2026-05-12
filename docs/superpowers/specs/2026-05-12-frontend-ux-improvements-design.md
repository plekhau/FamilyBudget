# FamilyBudget — Frontend UX Improvements Design

**Date:** 2026-05-12
**Scope:** Polish pass on existing pages (auth, settings, spaces) + shared patterns that budget pages will inherit. Goal: catch issues before they spread to every new page.

---

## Context

The app targets a family group across desktop and mobile/WebView. Simplicity and accessibility take priority over aesthetic novelty. This pass fixes concrete bugs, resolves the most jarring UX gaps, and establishes three shared patterns (Avatar, Skeleton, Toast) before the budget pages are built.

---

## Changes

### 1. Spacing — forms and member lists

**Problem:** `space-y-1` (4px) between label and input is too tight everywhere. Member rows use a floating gap that makes them feel like a loose pile rather than a list.

**Fix:**
- Label → input gap: `space-y-1` → `space-y-2` (8px) in all form field groups across LoginPage, RegisterPage, SettingsPage, CreateSpaceModal.
- Form field group spacing: `space-y-4` → `space-y-5` (20px) between groups.
- MemberRow list: replace `space-y-3` gap with `divide-y divide-border` on the container + `py-2.5` padding on each row. Gives each member a clear visual unit.

Applies to: [LoginPage.tsx](frontend/src/features/auth/LoginPage.tsx), [RegisterPage.tsx](frontend/src/features/auth/RegisterPage.tsx), [SettingsPage.tsx](frontend/src/features/settings/SettingsPage.tsx), [CreateSpaceModal.tsx](frontend/src/features/spaces/CreateSpaceModal.tsx), [SpacesPage.tsx](frontend/src/features/spaces/SpacesPage.tsx).

---

### 2. SpacesPage header — space switcher + floating h2

**Problem:** Two separate issues compound each other. A native `<select>` (inconsistent with shadcn design language) switches spaces. A standalone `<h2>` with the space name floats between the header row and the Members card, visually unanchored.

**Fix:** Replace both with a single shadcn `DropdownMenu` in the header row. The active space name is the dropdown trigger itself:

```
[ Spaces                    ]   [ Home Budget ▾ ]  [ + New Space ]
[ Members card              ]
[ Invite card               ]
[ Danger Zone card          ]
```

- The `DropdownMenu` trigger shows the active space name with a chevron. Clicking opens a menu listing all spaces; selecting one calls `setSelectedSpaceId`.
- When the user has only one space, render the space name as a plain `<span>` with no dropdown affordance (no point switching when there's nothing to switch to).
- Remove the `<h2>{selectedSpace.name}</h2>` entirely — context is now in the header.

Components: shadcn `DropdownMenu` (add via shadcn CLI). Changes in [SpacesPage.tsx](frontend/src/features/spaces/SpacesPage.tsx).

---

### 3. PrimaryRail — tooltips

**Problem:** Icon-only navigation gives no label on hover. The `Users` icon for "Spaces" is particularly non-intuitive.

**Fix:** Wrap each `RailIcon` in a shadcn `Tooltip` with `side="right"`. The `label` field already exists on every nav item object — no data changes needed.

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <NavLink ...>
        <Icon className="h-4 w-4" />
      </NavLink>
    </TooltipTrigger>
    <TooltipContent side="right">{label}</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Add `<TooltipProvider>` once in [main.tsx](frontend/src/main.tsx) wrapping the app (or in AppShell). Changes in [PrimaryRail.tsx](frontend/src/components/layout/PrimaryRail.tsx).

Components: shadcn `Tooltip` (add via shadcn CLI).

---

### 4. InviteCard — "Copied!" feedback

**Problem:** Clicking "Copy" copies the URL to clipboard but gives no visual confirmation.

**Fix:** Add a `copied` boolean state. On click: copy, set `copied = true`, revert after 2 s.

```tsx
const [copied, setCopied] = useState(false)

const handleCopy = () => {
  void navigator.clipboard.writeText(inviteUrl)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

Button renders: `copied ? <Check className="h-4 w-4" /> : 'Copy'`. Changes in [SpacesPage.tsx](frontend/src/features/spaces/SpacesPage.tsx).

---

### 5. Bug fixes

**5a. `noValidate` on `<input>` (RegisterPage)**
[RegisterPage.tsx:52](frontend/src/features/auth/RegisterPage.tsx#L52) has `noValidate` on an `<input>` — this attribute is only valid on `<form>` and does nothing here. Remove it. The `<form>` on line 44 already carries `noValidate`.

**5b. Budget sub-nav routes (ContextPanel)**
[ContextPanel.tsx](frontend/src/components/layout/ContextPanel.tsx) shows Budget sub-nav links (Transactions, Categories, Recurring, Reports) that currently navigate to non-existent routes. Add stub route entries in [router/index.tsx](frontend/src/router/index.tsx) that render a minimal placeholder:

```tsx
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {title} — coming soon
    </div>
  )
}
```

One stub component, four route entries. Prevents 404s and gives a clear signal during development.

**5c. AcceptInvitePage blank flash**
[AcceptInvitePage.tsx:34](frontend/src/features/spaces/AcceptInvitePage.tsx#L34) returns `null` while the redirect `useEffect` fires, causing a blank screen. Replace with the same centered card skeleton used for the loading state:

```tsx
if (!user) return <div className="flex min-h-screen items-center justify-center"><Skeleton className="h-40 w-80 rounded-xl" /></div>
```

**5d. Admin role badge — centralise colours**
[SpacesPage.tsx:31](frontend/src/features/spaces/SpacesPage.tsx#L31): the role badge colour logic is inlined in `MemberRow`. The existing blue for admin (`bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`) already handles dark mode correctly, so the colours stay as-is. The fix is to extract a small `RoleBadge` component within the same file so the colour mapping lives in one place:

```tsx
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      'rounded px-1.5 py-0.5 text-xs font-medium',
      role === 'owner' && 'bg-primary/10 text-primary',
      role === 'admin' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      role === 'member' && 'bg-muted text-muted-foreground'
    )}>
      {role}
    </span>
  )
}
```

---

### 6. Shared `<Avatar>` component

**Problem:** Avatar initials circles are created inline in MemberRow (`h-8 w-8`) and SettingsPage (`h-10 w-10`) with different sizing. Budget pages will add more.

**Fix:** Create `src/components/ui/avatar-initials.tsx`:

```tsx
interface Props {
  name: string
  size?: 'sm' | 'md'  // sm = h-8 w-8, md = h-10 w-10 (default: sm)
}

export function AvatarInitials({ name, size = 'sm' }: Props) {
  const initial = name[0]?.toUpperCase() ?? '?'
  return (
    <div className={cn(
      'flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
      size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
    )}>
      {initial}
    </div>
  )
}
```

Replace inline avatar divs in [SpacesPage.tsx](frontend/src/features/spaces/SpacesPage.tsx) and [SettingsPage.tsx](frontend/src/features/settings/SettingsPage.tsx).

---

### 7. Loading skeleton pattern

**Problem:** No loading state anywhere. `useSpaces()` loading renders nothing; budget pages will need skeletons too.

**Fix:** Add shadcn `Skeleton` (via shadcn CLI). Use it in SpacesPage while spaces are loading:

```tsx
const { data: spaces = [], isLoading } = useSpaces()

if (isLoading) return (
  <div className="mx-auto max-w-2xl space-y-6">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-48 w-full rounded-xl" />
    <Skeleton className="h-32 w-full rounded-xl" />
  </div>
)
```

This establishes the pattern. Budget pages copy it. File: [SpacesPage.tsx](frontend/src/features/spaces/SpacesPage.tsx).

---

### 8. Toast notification system (Sonner)

**Problem:** Success/error feedback is inline text scattered across components. No consistent pattern — future pages will each invent something.

**Fix:** Install `sonner`. Add `<Toaster />` once in [main.tsx](frontend/src/main.tsx). Replace the inline `updateProfile.isSuccess` green text in [SettingsPage.tsx](frontend/src/features/settings/SettingsPage.tsx) with `toast.success('Profile saved')`. Replace `createSpace.isError` inline text with `toast.error('Failed to create space')`.

Pattern for all future pages:
- Mutation success → `toast.success('...')`
- Mutation error → `toast.error('...')`
- Inline error text is reserved for field-level validation only.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/main.tsx` | Add `<TooltipProvider>`, `<Toaster />` |
| `frontend/src/components/ui/avatar-initials.tsx` | **New** — shared Avatar component |
| `frontend/src/components/layout/PrimaryRail.tsx` | Wrap icons in `<Tooltip>` |
| `frontend/src/router/index.tsx` | Add 4 stub budget routes |
| `frontend/src/features/auth/RegisterPage.tsx` | Remove `noValidate` from `<input>` |
| `frontend/src/features/auth/LoginPage.tsx` | Fix label→input spacing |
| `frontend/src/features/settings/SettingsPage.tsx` | Fix spacing, use `AvatarInitials`, toast |
| `frontend/src/features/spaces/SpacesPage.tsx` | Space switcher → DropdownMenu, remove h2, fix spacing, MemberRow dividers, AvatarInitials, role badge, copy feedback, skeleton |
| `frontend/src/features/spaces/CreateSpaceModal.tsx` | Fix label→input spacing |
| `frontend/src/features/spaces/AcceptInvitePage.tsx` | Replace null return with skeleton |

---

## Out of Scope

- Mobile drawer slide animation
- Active space name in mobile top bar
- Forgot password flow
- Avatar image upload
- Remove/change member roles (no backend endpoint)
