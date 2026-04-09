# FamilyBudget — React Frontend Design

**Date:** 2026-04-08
**Scope:** React frontend — Phase 1 (Auth + Settings). Budget features are subsequent phases.

---

## Overview

A React SPA backed by the existing Django REST API. The app targets web browsers and will also be embedded in Android/iOS WebViews — layout and interactions must work equally well at mobile viewport sizes. The first phase implements authentication (login, register) and the user settings screen. All other sections (budget, reports, spaces) are deferred to later phases.

---

## Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Build tool | Vite | Fast HMR, standard for new React projects |
| Language | TypeScript | Strict mode enabled |
| Routing | React Router v7 | File-based or config routing; v7 loader/action patterns |
| Server state | TanStack Query v5 | Caching, loading states, error handling for REST API calls |
| Client state | Zustand | Auth token + theme preference; lightweight, no boilerplate |
| Styling | Tailwind CSS v4 | Utility-first; pairs with shadcn/ui |
| UI components | shadcn/ui | Components are copied into the codebase (not a dependency). Built on Radix UI. Full dark mode via CSS variables. |
| Charts | Recharts | Most popular React chart lib; responsive; used in budget phase |
| Forms | React Hook Form + Zod | RHF for perf, Zod for schema validation and type inference |
| Icons | Lucide React | Consistent with shadcn/ui |
| HTTP client | Axios | Interceptors for JWT attach + 401 token refresh |
| Testing | Vitest + React Testing Library | Vite-native, fast |
| Package manager | pnpm | Faster and more disk-efficient than npm |

---

## Project Structure

```
frontend/
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
  .env.example              ← VITE_API_BASE_URL
  src/
    main.tsx                ← app entry, providers
    App.tsx                 ← router setup
    lib/
      api.ts                ← Axios instance + interceptors
      queryClient.ts        ← TanStack Query client config
    store/
      authStore.ts          ← Zustand: tokens, user info
      themeStore.ts         ← Zustand: light | dark | system
    hooks/
      useAuth.ts            ← login, logout, register mutations
    components/
      ui/                   ← shadcn/ui generated components
      layout/
        AppShell.tsx        ← two-panel shell (rail + context panel + content)
        PrimaryRail.tsx     ← narrow left icon rail
        ContextPanel.tsx    ← second panel showing section sub-items
        MobileDrawer.tsx    ← wraps rail+panel for mobile slide-in
    features/
      auth/
        LoginPage.tsx
        RegisterPage.tsx
      settings/
        SettingsPage.tsx
    router/
      index.tsx             ← route definitions
      PrivateRoute.tsx      ← redirects to /login if unauthenticated
```

Feature code lives under `src/features/<name>/`. Shared UI under `src/components/`. API calls are co-located with their feature or in dedicated hook files.

---

## Navigation Architecture

### Two-panel Discord-style layout (authenticated)

```
┌──────────┬───────────────────┬──────────────────────────────┐
│  Rail    │  Context Panel    │  Page Content                │
│  (48px)  │  (180px)          │  (flex: 1)                   │
│          │                   │                              │
│  [F]     │  BUDGET           │                              │
│  🏠      │  > Transactions   │  <active page renders here>  │
│  💰 ●    │    Categories     │                              │
│  👥      │    Recurring      │                              │
│          │    Reports        │                              │
│  ─────   │                   │                              │
│  ⚙️      │                   │                              │
└──────────┴───────────────────┴──────────────────────────────┘
```

- **PrimaryRail** — fixed-width icon strip. Each icon represents a top-level section: Dashboard, Budget, Spaces. Settings is pinned to the bottom. Active section highlighted.
- **ContextPanel** — shows sub-navigation for the active rail section. For Budget: Transactions, Categories, Recurring, Reports. Sections without sub-items (Dashboard, Settings) hide this panel or show it empty.
- **Page Content** — the routed page component fills the remaining space.

### Mobile behaviour

On viewports < 768px the rail + context panel are hidden by default and slide in as a single drawer (triggered by a hamburger button in a top bar). Tapping any nav item closes the drawer. This works well in WebView.

### Top-level sections (Phase 1 stub, future)

| Rail icon | Section | Sub-items |
|---|---|---|
| 🏠 | Dashboard | — (direct page) |
| 💰 | Budget | Transactions, Categories, Recurring, Reports |
| 👥 | Spaces | — (direct page) |
| ⚙️ | Settings | — (direct page, pinned bottom) |

Future sections (e.g. ToDo) are added as new rail icons.

---

## Theme System

Three modes: **Light**, **Dark**, **System** (default). Stored in Zustand + `localStorage`.

- shadcn/ui provides CSS variables for all colours; switching theme adds/removes the `dark` class on `<html>`.
- `ThemeProvider` component reads the Zustand store, applies the class, and listens to `window.matchMedia` for system changes.
- Accent colour: indigo/violet (`#6366f1` / `--primary`).

---

## Auth Flow

```
/login  ──── POST /api/auth/token/ ────► store access + refresh tokens (Zustand + memory)
/register ── POST /api/auth/register/ ─► auto-login on success → redirect to app
```

- **Access token** stored in memory (Zustand). Never written to `localStorage` — avoids XSS token theft.
- **Refresh token** stored in `localStorage`. Used by Axios interceptor to silently refresh on 401.
- On logout: `POST /api/auth/token/blacklist/` then clear Zustand + localStorage.
- `PrivateRoute` redirects unauthenticated users to `/login`. After login, redirects back to the originally requested path.
- After registration, redirect to `/login` with a success toast prompting sign-in (keeps flow simple; no auto-login complexity).

---

## Phase 1 Screen Inventory

### `/login` — Login Page
- Fields: email, password
- Submit → POST `/api/auth/token/`
- Zod schema validation (email format, password min length)
- Error toast on invalid credentials
- Link to `/register`
- No sidebar; centered card layout (same on mobile)

### `/register` — Register Page
- Fields: display name, email, password, confirm password
- Submit → POST `/api/auth/register/`
- Zod validation (passwords match, email format)
- Error toast on conflict (email already in use)
- Link to `/login`

### `/settings` — Settings Page (authenticated)
- Rendered inside AppShell; Settings icon active in rail
- **Profile section**: editable display name, read-only email, avatar initials. Requires a new backend endpoint `PATCH /api/auth/me/` (not yet implemented — must be added as part of this phase).
- **Appearance section**: Light / System / Dark picker — updates Zustand themeStore (client-side only, no API call)
- **Account section**: Sign Out button — calls logout, redirects to `/login`

---

## API Integration

All requests go through a single Axios instance (`src/lib/api.ts`):

1. **Request interceptor** — attaches `Authorization: Bearer <access_token>` from Zustand store.
2. **Response interceptor** — on 401, attempts silent refresh via `POST /api/auth/token/refresh/`. On success, retries the original request. On refresh failure, logs out and redirects to `/login`.

TanStack Query wraps all reads (`useQuery`) and mutations (`useMutation`). Queries are keyed by resource + filters (e.g. `['transactions', spaceId, month]`).

---

## Testing Approach

- **Unit tests** — Vitest for pure functions (Zod schemas, store logic, utility helpers)
- **Component tests** — React Testing Library for form validation behaviour, auth redirects
- **No mocked API** in integration tests — use MSW (Mock Service Worker) to intercept HTTP at the network level, keeping tests realistic without a real server

---

## Out of Scope (Phase 1)

- Budget, Reports, Categories, Recurring Transactions pages
- Spaces management page
- Dashboard page
- Forgot password / password reset
- Avatar image upload
- Change email
- Invite flow UI
