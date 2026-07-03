# FamilyBudget — Budget Section Frontend + Space Currency Design

**Date:** 2026-07-02
**Status:** Approved
**Scope:** The four Budget pages (Transactions, Categories, Recurring, Reports) plus per-space currency support. Mostly frontend; includes a small, contained backend slice for currency.

---

## Overview

The Budget section replaces the four `ComingSoon` stubs with real pages backed by the existing `/api/budgets/` API. All pages are scoped to the currently selected space (`spaceStore.selectedSpaceId`). Amounts are displayed with the space's currency symbol; currency is chosen at space creation (pre-filled from browser locale) and editable later by owner/admin.

Research input (competitive analysis + budget UX research in `tmp/`) shaped the priorities: low-friction transaction entry above all, few taps, smart defaults. Voice entry, OCR, and bank sync are explicitly out of scope — the backend supports none of them.

---

## Backend changes (small slice)

### `Space.currency`

- New field on `spaces.Space`: `currency = models.CharField(max_length=3, default="USD")` — ISO 4217 code, stored uppercase. Migration defaults existing spaces to `USD`.
- `SpaceSerializer` gains `currency` (writable).
- `POST /api/spaces/` accepts optional `currency`; defaults to `USD` when absent.

### `PATCH /api/spaces/{id}/` (new endpoint)

- Partial update for `name` and `currency`.
- Permission: space **owner or admin** only (use existing `IsSpaceOwnerOrAdmin` from `apps/spaces/permissions.py`). Members receive `403`.
- No currency *conversion* — changing currency only changes display.

### Category delete with transactions

`Transaction.category` is `on_delete=PROTECT`, so deleting an in-use category raises `ProtectedError` (currently an unhandled 500). Handle it in `CategoryDetailView.destroy` (or a shared exception handler) and return **`409 Conflict`** with `{"detail": "This category has transactions and cannot be deleted."}`. Same applies when the category is referenced by a `RecurringTransaction`.

### Backend tests

- Space create with/without currency; invalid code rejected (must be 3 alpha chars).
- PATCH currency as owner/admin (200) and as member (403); PATCH by non-member (403).
- Category delete returns 409 when transactions exist, 204 when unused.

---

## Frontend

### Routes

The four stubs in `src/router/index.tsx` become lazy-loaded private pages inside `AppShell` (ContextPanel sub-nav already exists):

| Route | Page |
|---|---|
| `/budget` | redirect → `/budget/transactions` |
| `/budget/transactions` | `TransactionsPage` |
| `/budget/categories` | `CategoriesPage` |
| `/budget/recurring` | `RecurringPage` |
| `/budget/reports` | `ReportsPage` |

### Space scoping & empty state

Every budget page reads `selectedSpaceId` from `spaceStore`. When the user has no spaces (`selectedSpaceId === null` after `useSpaces()` resolves), all four pages render a shared `NoSpaceState` component: "Create a space to start tracking your budget" + link to `/spaces`.

### Data layer — `src/hooks/useBudget.ts`

Follows the `useSpaces.ts` pattern (TanStack Query + shared Axios instance):

| Hook | Query key |
|---|---|
| `useCategories(spaceId)` | `['categories', spaceId]` |
| `useTransactions(spaceId, { month, categoryId })` | `['transactions', spaceId, month, categoryId]` |
| `useRecurring(spaceId)` | `['recurring', spaceId]` |
| `useReport(spaceId, periodType, periodValue)` | `['report', spaceId, periodType, periodValue]` |

Mutations (`useCreate/Update/Delete` per resource) invalidate their list key; transaction mutations also invalidate `['report', spaceId]` (prefix match). Space settings mutation (`useUpdateSpace` in `useSpaces.ts`) invalidates `['spaces']`.

Member names: transactions carry `paid_by` as a user ID. A `memberName(spaces, spaceId, userId)` helper (or a `useSpaceMembers(spaceId)` hook deriving from cached `useSpaces()` data) maps IDs to display names. No new API calls.

### Currency

- **`src/lib/money.ts`** — `formatMoney(amount: string | number, currency: string)` using `Intl.NumberFormat` with `style: 'currency'`, `currencyDisplay: 'narrowSymbol'`. Bare symbols only: `$84.20`, `€84.20`, never `USD 84.20` or `US$84.20`. Separators and symbol position follow the currency's own convention. Income amounts render green with a leading `+`; expenses plain.
- **`src/lib/currencies.ts`** — a curated static list (~30 common currencies): `{ code, symbol, name }`. Picker labels are **symbol first, then name** ("€ Euro", "$ US Dollar") — ISO codes never appear in the UI.
- **Locale guess** — `defaultCurrencyForLocale()`: derive region from `navigator.language` via `Intl.Locale`, map region → currency with a small static map covering the curated list's countries; fallback `USD`.
- **Create Space modal** gains a currency `<select>`, pre-selected from the locale guess, with helper text "Guessed from your browser language — change it if it's wrong".
- **Spaces page** gains a "Space settings" card (between Invite and Danger Zone): currency select + Save, visible to owner/admin only, with note "Changes how amounts are displayed for everyone in this space. Existing amounts are not converted." Uses `PATCH /api/spaces/{id}/`; success/error via toast.

### Dates — `src/lib/dates.ts`

- `formatMonth('2026-05')` ↔ "May 2026"; `stepMonth(month, ±1)`.
- Week handling for the weekly report: weeks start **Monday** (ISO 8601). `startOfWeek(date)`, `stepWeek(weekStart, ±1)`, `formatWeekRange(weekStart)` → "12–18 May 2026".
- Day headings on the transactions list: "THU, MAY 14" style via `Intl.DateTimeFormat`.

---

## Pages

### 1. Transactions (`/budget/transactions`)

The everyday page. Layout top to bottom:

**Header row:** month stepper (`‹ May 2026 ›`, drives the `month` query param; defaults to current month), category filter `<select>` ("All categories" + each category), "+ Add" primary button.

**List:** transactions grouped by day, newest day first, a muted uppercase day heading per group, rows divided with `divide-y` (same pattern as MemberRow). Each row: category icon + name, payer display name muted, amount right-aligned (`formatMoney`; income green `+`, expense plain). Row click opens the edit dialog.

**Empty state:** "No transactions in May 2026" + Add button. **Loading:** skeleton rows (established Skeleton pattern).

**Add/Edit dialog** (shadcn Dialog, same pattern as CreateSpaceModal):

- Fields: amount (auto-focused, `inputmode="decimal"`), category (select, grouped expense/income), date (defaults today), paid by (select of space members, defaults current user), notes (optional).
- Smart defaults on add: date = today, payer = current user, category = last-used category (persisted in `localStorage` per space; falls back to first expense category).
- Edit mode: same dialog pre-filled, plus a Delete button with inline confirm.
- Validation (Zod): amount required, positive, ≤ 2 decimals; category and date required. Form has `noValidate`.
- Mutations: `POST/PATCH/DELETE /api/budgets/transactions/…` (`space_id` in body on create). Success closes dialog + `toast.success`; error `toast.error`.

### 2. Categories (`/budget/categories`)

Two card sections: **Expenses** and **Income** (split by `is_income`). Each row: emoji icon, name, edit (pencil) and delete (trash) icon buttons.

- "+ Add category" opens a dialog: icon (single text input holding an emoji, defaults 📦), name (required), "This is income" switch. Edit uses the same dialog pre-filled.
- Delete: inline confirm; on `409` from the backend show `toast.error('This category has transactions and cannot be deleted.')`.
- Mutations invalidate `['categories', spaceId]`; since category names/icons appear on transactions and reports, also invalidate `['transactions', spaceId]` and `['report', spaceId]` prefixes.

### 3. Recurring (`/budget/recurring`)

Single list card. Each row: category icon, description, muted "frequency · next: {date}" line, amount, and an **active/paused Switch** (shadcn) that PATCHes `is_active` directly from the row. Paused rows render muted.

- "+ Add recurring" dialog fields: amount, category, description (required), frequency (weekly/monthly/yearly), start date (defaults today). `next_due_date` is sent equal to `start_date` on create (backend requires it; the generator command advances it afterwards). Edit shows `next_due_date` read-only for context.
- Edit/delete via row click, same dialog + Delete with inline confirm.
- Info hint under the list: "Recurring transactions are added to your history automatically when they come due."

### 4. Reports (`/budget/reports`)

**Header:** period-type tabs (Week / Month / Year, shadcn Tabs, default Month) + a period stepper matching the type (`‹ May 2026 ›`, `‹ 12–18 May 2026 ›`, `‹ 2026 ›`). Each type maps to its endpoint: `weekly-summary?week=` (Monday of the shown week), `monthly-summary?month=`, `yearly-summary?year=`.

**Content:**

1. **Summary cards** — Income, Expenses, Net. The report response has no `is_income` flag, so totals are computed by joining rows against `useCategories(spaceId)` data. Net = income − expenses; green when ≥ 0, red when negative.
2. **Donut chart** — Recharts `PieChart` (inner radius for donut) of **expense** categories only, one segment per category. Add `recharts` dependency (already planned in the Phase 1 design).
3. **Category list** — each row: icon + name, `formatMoney` total, muted % share of expenses. Income categories listed in a separate small group below.

**Empty state:** "No data for this period." **Loading:** skeletons.

---

## MSW handlers (tests)

Add to `src/mocks/handlers.ts`:

```
GET/POST        /api/budgets/categories/            (+ PATCH/DELETE /:id/, DELETE can return 409)
GET/POST        /api/budgets/transactions/          (+ PATCH/DELETE /:id/)
GET/POST        /api/budgets/recurring-transactions/ (+ PATCH/DELETE /:id/)
GET             /api/budgets/reports/:reportType/
PATCH           /api/spaces/:id/
```

## Testing approach

TDD throughout (failing test → implement → pass), Vitest + RTL, docstring on every test, no imports inside test functions. One `__tests__` folder per feature page. Key cases:

- **TransactionsPage:** renders month's transactions grouped by day; month stepper refetches; category filter; add dialog smart defaults (today, current user, last-used category); create/edit/delete flows; income renders green with `+` and symbol; no-space state.
- **CategoriesPage:** expense/income grouping; add/edit dialog; delete 409 shows toast.
- **RecurringPage:** list rendering; pause toggle PATCHes `is_active`; create with `next_due_date = start_date`.
- **ReportsPage:** tab switch hits correct endpoint; income/expense/net computed via category join; donut renders expense categories; period stepper.
- **money.ts / dates.ts / currency guess:** unit tests (formatting per currency, narrow symbols, month/week stepping, locale → currency fallback).
- **Spaces additions:** currency picker in create modal (pre-filled), settings card visibility by role, PATCH flow.

---

## Out of scope

- Voice entry, receipt OCR, bank sync / auto-import (research-identified, no backend support)
- Dashboard page (separate phase)
- Currency conversion or historical exchange rates
- Per-category budget limits, savings goals
- Transaction list pagination (family-scale data, month-filtered)
- Editing `next_due_date` manually; running the recurring generator from the UI
- Member management (remove/roles) — unchanged from spaces phase
