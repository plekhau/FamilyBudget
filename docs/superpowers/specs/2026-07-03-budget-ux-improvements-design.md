# FamilyBudget — Budget Section UX Improvements Design

**Date:** 2026-07-03
**Status:** Approved
**Scope:** UX polish pass over the Budget section shipped 2026-07-02 (Transactions, Categories, Recurring, Reports). Mostly frontend; two small backend slices (`Space.locale`, category `transaction_count`).

---

## Overview

A senior-UX review of the budget pages surfaced ten improvements. The user approved all of them and picked the approach for each contested item. No new pages; every change lands inside existing components.

Decisions made during review:

- Transactions totals: month summary strip **and** per-day subtotals.
- Reports summary cards: stack vertically below the `sm` breakpoint.
- Jump to today: conditional "Today" button, visible only off the current period.
- Date formatting: per-space **locale** picker driving both dates and money (not a date-pattern preset, not browser-only).
- Amount inputs accept `.` and `,` as decimal separators, treated identically.
- Explicitly declined: promoting notes to the transaction row's primary line, changing the Reports empty state.

---

## 1. Transactions page totals (`TransactionsPage.tsx`)

### Month summary strip

- Renders between the header row and the transaction list whenever the list is non-empty; hidden while loading and on the empty state.
- Content: `Income +X · Spent Y · Net ±Z`, computed client-side from the already-fetched `transactions` array using `categoryById` to classify income vs expense. No new API call.
- Colors follow the existing convention: income and positive net in `text-green-600 dark:text-green-400`; negative net in `text-destructive`; Spent neutral.
- **Filter interaction:** the strip sums the currently displayed (filtered) transactions — what you see is what's counted.

### Day subtotals

- Each day heading row becomes `flex justify-between`: existing date label left, day total right, same muted/uppercase styling.
- Day total = income − expenses for that day. Positive → green `+X`; otherwise plain `X` showing the net spent amount (absolute value). Mirrors the Net card convention on Reports.

## 2. Reports chart & legend (`ReportsPage.tsx`)

- Sort `expenseRows` by `Number(total)` descending before computing `chartData` and rendering the legend list — slice order, legend order, and color assignment all follow size.
- Legend rows get a leading color swatch (small rounded `span` with inline `backgroundColor: CHART_COLORS[i]`) matching the slice.
- Add Recharts `<Tooltip>` to the `PieChart`, formatted as `{icon} {name} — {formatMoney(value)} ({percent}%)`.
- Extend `CHART_COLORS` from 8 to 12 visually distinct hues (indigo, amber, emerald, red, violet, teal, orange, pink, cyan, lime, rose, sky) — no grays, so the "Other" slice below stays unambiguous.
- **Other grouping:** if there are more than 12 expense rows, the chart shows the top 11 plus one "Other" slice aggregating the rest, in a reserved neutral gray that is not part of the palette. The legend list still shows every individual category row (rows 12+ get the gray swatch).

## 3. Reports summary cards (`ReportsPage.tsx`)

- Container changes from `flex gap-3` to `grid grid-cols-1 gap-3 sm:grid-cols-3`.
- Below `sm`, `SummaryCard` renders as a full-width horizontal row: label left, value right (`flex items-center justify-between`). At `sm+` it keeps today's centered stacked look. One component, responsive classes — no fork.

## 4. Amount inputs (`TransactionDialog.tsx`, `RecurringDialog.tsx`)

- Zod amount schema becomes `^\d+([.,]\d{1,2})?$`; error message: "Enter a positive amount, e.g. 12.50".
- On submit, normalize `,` → `.` before building the payload (backend contract unchanged).
- The Amount label shows the space currency symbol: `Amount (€)`. New helper in `src/lib/money.ts`:

```ts
export function currencySymbol(currency: string, locale?: string): string
```

implemented via `Intl.NumberFormat(...).formatToParts()`, `currencyDisplay: 'narrowSymbol'`. `RecurringDialog` currently receives only `spaceId` — its props change to take `space` (as `TransactionDialog` already does) so it can access `currency` (and `locale`, §5).

## 5. Per-space formatting locale

### Backend

- `Space.locale = models.CharField(max_length=10, blank=True, default="")` — empty string means "Auto (browser)". Migration defaults existing spaces to `""`.
- `SpaceSerializer` gains `locale` (writable), validated against the supported list: `en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `pl-PL`, `ru-RU` (plus `""`). Editable through the existing `PATCH /api/spaces/{id}/` (owner/admin, same permission as `currency`).

### Frontend

- Space settings section in `SpacesPage.tsx` gains a "Formatting" `NativeSelect` next to Currency, listing "Auto (browser)" plus the supported locales with human labels ("English (US)", "German", …). Saved via the existing `useUpdateSpace`.
- `src/lib/dates.ts`: `formatMonth`, `formatDayHeading`, `formatWeekRange` take a `locale` parameter (replacing hardcoded `'en-US'`).
- Resolution rule, applied everywhere: `space.locale || navigator.language`, passed to **both** date formatters and `formatMoney` — dates and money can never disagree. A small helper on the budget side (e.g. `spaceLocale(space)`) keeps the rule in one place.

## 6. Today button (`TransactionsPage.tsx`, `ReportsPage.tsx`)

- A ghost `size="sm"` "Today" button beside the chevrons, rendered only when the viewed period ≠ current period (Transactions: `month !== currentMonth()`; Reports: compare against `currentMonth()` / `currentWeekStart()` / current year per period type).
- Clicking resets the active period state to now. On Reports it resets only the active period type's value.

## 7. Small fixes

- **Frequency labels** (`RecurringPage.tsx`): render capitalized — "Weekly" / "Monthly" / "Yearly" — via a label map, not raw `item.frequency`.
- **"Keep" → "Cancel"** in all three inline delete confirmations: `CategoryRow` (CategoriesPage), `TransactionDialog`, `RecurringDialog`.
- **Category transaction counts** (`CategoriesPage.tsx` + backend): category list endpoint annotates `transaction_count` (`Count("transactions")` on the list queryset; serializer gains a read-only field). Row shows a muted `n transactions` hint (hidden when 0) so undeletable categories are predictable. The 409 delete handling stays as the safety net.

---

## Out of scope

- Notes-first transaction row labels (declined).
- Reports empty-state CTA (declined).
- Any currency conversion, bank sync, or new report types.

---

## Testing

### Frontend (Vitest + MSW)

- TransactionsPage: summary strip totals (mixed income/expense fixture, respects category filter), day subtotal rendering incl. green `+` case, Today button hidden on current month / shown and functional on another month.
- ReportsPage: legend sorted descending with swatches, cards stack via grid classes, Today button per period type, "Other" grouping with a >12-category fixture.
- Dialogs: `12,50` accepted and submitted as `12.50`; `12.50` unchanged; invalid still rejected; Amount label shows the space currency symbol.
- money/dates: `currencySymbol` for a few currencies; date formatters honor a passed locale; `space.locale` overrides browser locale on a page-level test.
- Delete confirmations show "Cancel"; frequency labels capitalized; category rows show transaction counts.

### Backend (pytest)

- `PATCH /api/spaces/{id}/` accepts each supported locale and `""`; rejects unsupported values (400); member gets 403 (existing permission).
- Category list includes correct `transaction_count` (0 and >0 cases).
