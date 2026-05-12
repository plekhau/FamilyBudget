# FamilyBudget — Spaces Frontend Design

**Date:** 2026-05-11
**Scope:** React frontend — Spaces section. Backend API is fully implemented.

---

## Overview

The Spaces section lets users manage their shared budget groups. Most users will have exactly one space (their household). Multiple spaces are supported but uncommon. The design mirrors the Settings page: card-based layout, no sub-navigation panel.

Two new routes are added: `/spaces` for space management and `/invite` for accepting invite links.

---

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/spaces` | Private (PrivateRoute) | Manage current space, switch spaces, invite members |
| `/invite` | Public | Accept an invite via `?token=…` URL param |

`/invite` is public so unauthenticated users can land on it from an email or shared link. They are redirected to `/login?redirect=/invite?token=…` and the invite is processed after sign-in.

---

## Active Space State — `spaceStore`

A new Zustand store, persisted to localStorage under the key `"space"`.

```typescript
interface SpaceState {
  selectedSpaceId: number | null
  setSelectedSpaceId: (id: number | null) => void
}
```

`selectedSpaceId` drives which space is shown on the Spaces page and will be used as the `space_id` param for all budget API calls in a future phase.

**Edge cases:**
- No spaces → `selectedSpaceId` is `null`; show empty state
- One space → `selectedSpaceId` set to that space's id; no switcher shown
- Multiple spaces → full dropdown switcher shown
- Selected space no longer accessible (deleted or removed) → fall back to first available space on next `useSpaces()` response

---

## Spaces Page (`/spaces`)

Rendered inside `AppShell`. Settings icon replaced by Spaces icon active in rail (already stubbed).

### Layout (top to bottom)

**1. Space header row**

```
[ 🏠 Home Budget ]          [ Switch ▾ ]  [ + New Space ]
```

- Space name shown on the left
- "Switch ▾" dropdown only rendered when `spaces.length > 1`; lists all spaces by name; clicking one calls `setSelectedSpaceId`
- "+ New Space" button opens `CreateSpaceModal`

**2. Members card**

Section title: "Members · N"

Lists all members of the selected space. Each row:
- Avatar initials circle (like Settings)
- Display name + `(you)` marker for the current user
- Email in muted text
- Role badge: `owner` (indigo), `admin` (blue), `member` (slate)

No remove or role-change actions — backend does not support these.

**3. Invite card**

Section title: "Invite Someone"

- Optional email `<Input>` with placeholder `"Email address (optional)"`
- "Generate Link" `<Button>`
- On submit: `POST /api/spaces/{id}/invites/` with `{ email }` (email omitted if empty; backend defaults `expires_at` to 7 days)
- On success: display the full invite URL in a read-only copyable input:
  `{window.location.origin}/invite?token={token}`
  with a "Copy" button
- The link is session-only — no backend list endpoint exists to retrieve past invites after page refresh
- Any member can generate an invite (backend does not restrict to owner/admin)

**4. Danger zone card** (owner only)

Section title: "Danger Zone" in destructive colour.

- "Delete Space" button (variant: destructive)
- Clicking opens an inline confirmation: type the space name to confirm
- On confirm: `DELETE /api/spaces/{id}/` → invalidate spaces query → if deleted space was selected, select next available space or null → redirect to `/spaces`

### Empty state

When the user has no spaces:

```
You don't have any spaces yet.
Spaces let you share a budget with your household or group.
[ Create your first space ]
```

---

## Create Space Modal

Triggered by "+ New Space" button. A small `<Dialog>` (shadcn) with:
- Single `<Input>` for space name (required, min 1 char)
- "Create" button (disabled while pending)
- On success: close modal, auto-select new space, invalidate spaces query

---

## Accept Invite Page (`/invite`)

Not inside `AppShell` — standalone centered card layout (like Login/Register).

**Flow:**

1. Read `token` from `?token=` query param
2. If no token → show error card: "Invalid invite link."
3. If not authenticated → redirect to `/login?redirect=/invite?token={token}`; after login, React Router sends back to `/invite?token={token}`
4. If authenticated → show card:
   - Title: "You've been invited"
   - Body: "Accept the invitation to join a shared budget space."
   - "Accept Invitation" button
5. On accept: `POST /api/spaces/invites/accept/` with `{ token }`
6. On success: invalidate spaces query, auto-select new space, redirect to `/spaces`
7. Error states:
   - `400` invalid/expired token → "This invite link is invalid or has expired."
   - `403` wrong email → "This invite was sent to a different email address."

---

## File Map

**New files:**
- `frontend/src/store/spaceStore.ts`
- `frontend/src/hooks/useSpaces.ts`
- `frontend/src/features/spaces/SpacesPage.tsx`
- `frontend/src/features/spaces/CreateSpaceModal.tsx`
- `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx`
- `frontend/src/features/spaces/AcceptInvitePage.tsx`
- `frontend/src/features/spaces/__tests__/AcceptInvitePage.test.tsx`

**Modified files:**
- `frontend/src/router/index.tsx` — add `/spaces` (private) and `/invite` (public) routes
- `frontend/src/mocks/handlers.ts` — add MSW handlers for spaces endpoints
- `frontend/src/components/layout/ContextPanel.tsx` — no sub-items for Spaces section (already returns null for non-budget sections; no change needed)

---

## API Hooks (`useSpaces.ts`)

```typescript
useSpaces()          // GET  /api/spaces/
useCreateSpace()     // POST /api/spaces/
useDeleteSpace()     // DELETE /api/spaces/{id}/
useCreateInvite()    // POST /api/spaces/{id}/invites/
useAcceptInvite()    // POST /api/spaces/invites/accept/
```

All wrapped with TanStack Query (`useQuery` / `useMutation`). On mutations that change membership, invalidate the `['spaces']` query key.

---

## MSW Handlers (test doubles)

Added to `frontend/src/mocks/handlers.ts`:

```
GET  /api/spaces/                     → list of spaces with members
POST /api/spaces/                     → create space, return new space object
DELETE /api/spaces/:id/               → 204
POST /api/spaces/:spaceId/invites/    → return invite with token
POST /api/spaces/invites/accept/      → 200 or 400/403
```

---

## Testing

Both pages are tested with TDD (write failing test → implement → pass).

**SpacesPage tests:**
- Shows empty state when user has no spaces
- Shows space name and members for a single space
- Does not show Switch button when only one space
- Shows Switch dropdown when multiple spaces
- Create space modal opens, submits, auto-selects new space
- Invite generation shows copyable link
- Danger zone only visible to owner
- Delete requires name confirmation

**AcceptInvitePage tests:**
- Shows error when no token in URL
- Shows accept button when authenticated with valid token
- Redirects to `/spaces` on success
- Shows error on 400 (invalid/expired)
- Shows error on 403 (wrong email)

---

## Out of Scope

- Remove a member from a space (no backend endpoint)
- Change a member's role (no backend endpoint)
- List or revoke past pending invites (no list endpoint)
- Leave a space as a non-owner (no backend endpoint)
- Space name editing (no PATCH endpoint for spaces)
