# FamilyBudget — Dashboard Page Design

**Date:** 2026-07-09
**Status:** Approved
**Scope:** Frontend only. Replace the `/dashboard` "coming soon" stub with a real dashboard page composing existing APIs. No backend changes.

---

## Overview

A landing page that answers "how are we doing right now?" at a glance: period summary numbers, top spending categories, upcoming recurring payments, and recent activity. All data comes from existing endpoints through existing TanStack Query hooks (`useReport`, `useCategories`, `useTransactions`, `useRecurring`), so the established mutation-invalidation wiring keeps the dashboard live automatically.

Decisions made during review:

- Widget set: summary tiles, spending by category, recent transactions, upcoming recurring — all four.
- Period control: a **Month/Year toggle** pinned to the current month / current year. No prev/next stepping — historical browsing stays in Reports.
- Data strategy: **reuse existing APIs** (approach A); a dedicated dashboard endpoint was considered and rejected as unnecessary backend surface.
- Recent transactions are scoped to the **current month** (reuses the exact query key the transaction mutations invalidate). Early-month sparseness is acceptable; the empty state links to adding a transaction.

---

## 1. Route & navigation

- New lazy-loaded `DashboardPage` at `src/features/budget/DashboardPage.tsx`, registered at `/dashboard` in `src/router/index.tsx`, replacing the `ComingSoon` stub.
- The PrimaryRail "Dashboard" item already points at `/dashboard`; no ContextPanel sub-nav (the section has a single page).
- Space scoping via `useSelectedSpace`; renders `NoSpaceState` when the user has no space, skeletons while the space is loading.

## 2. Header & period toggle

- Title "Dashboard"; right-aligned shadcn `Tabs` with `Month` / `Year` triggers (same component pattern as Reports).
- The toggle drives the summary tiles and top-categories widgets: `month` → `useReport(spaceId, 'month', currentMonth())`, `year` → `useReport(spaceId, 'year', currentYear)`.
- Upcoming recurring and recent transactions ignore the toggle.

## 3. Widgets

Responsive layout: tiles row (3-up on `sm+`, stacked below), then a two-column row (`md+`; stacked below), then a full-width card.

### 3.1 Summary tiles

- Income / Expenses / Net for the selected period, formatted with `formatMoney` + space currency and locale.
- Computation: report rows split into income vs expense via `category.is_income` — the same logic ReportsPage uses, extracted into a shared helper (see §4) instead of duplicated.
- Colors follow the existing convention: income and positive net green, negative net `text-destructive`, expenses neutral.

### 3.2 Top categories

- Top 5 expense categories of the selected period, sorted by total descending.
- Rendered as a compact list: icon + name, amount, percentage of total expenses, and a proportional bar (plain div width, no Recharts).
- Footer link "View report →" to `/budget/reports`.
- Empty state: if there are no expense rows, show a muted "No expenses this period." message.

### 3.3 Upcoming recurring

- `useRecurring(spaceId)` filtered to `is_active`, sorted by `next_due_date` ascending, first 5.
- Each row: description, next due date (space locale), frequency label, amount.
- Footer link "Manage →" to `/budget/recurring`.
- Empty state: "No active recurring payments."

### 3.4 Recent transactions

- `useTransactions(spaceId, { month: currentMonth() })`, client-side slice of the first 6 (server orders by `-date, -created_at`).
- Each row: date (space locale), category icon + name, notes (muted, truncated), amount (income green with `+`).
- Footer link "View all →" to `/budget/transactions`.
- Empty state: "No transactions this month yet." linking to `/budget/transactions`.

## 4. Shared helper

- Extract the income/expense split currently inlined in `ReportsPage` into `src/features/budget/reportRows.ts`: `splitReportRows(rows, categories)` returning `{ incomeRows, expenseRows, incomeTotal, expenseTotal, net }` (expense rows sorted descending).
- `ReportsPage` switches to the helper; behavior unchanged.

## 5. Testing

`src/features/budget/__tests__/DashboardPage.test.tsx`, Vitest + MSW, mirroring existing page tests (docstring on every test, no imports inside test functions):

- Renders all four widgets from mocked handlers.
- Income/Expenses/Net math matches mocked report rows and `is_income` flags.
- Top categories: sorted descending, capped at 5, percentages computed against expense total.
- Upcoming recurring: inactive entries excluded, sorted by `next_due_date`, capped at 5.
- Recent transactions: capped at 6.
- Month/Year toggle: switching to Year requests the year report (assert via MSW request capture).
- Empty states render when the respective datasets are empty.
- `NoSpaceState` renders when the user has no space.

Existing `ReportsPage` tests must stay green after the helper extraction.

## Out of scope

- Backend changes of any kind.
- Period stepping / historical navigation on the dashboard.
- Dashboard-specific ContextPanel sub-navigation.
- Charts requiring Recharts on this page.
