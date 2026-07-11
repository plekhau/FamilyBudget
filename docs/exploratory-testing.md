# Exploratory testing playbook

A repeatable recipe for a full end-to-end pass over the live app in a real
browser — functional flows, design/UX, robustness, data isolation, and
accessibility. This is manual/agent-driven exploratory testing, distinct from
the automated `tests/` Playwright suite (still planned). Last run: 2026-07,
which surfaced the auth/invite/UX fixes in commit `07107f6`.

## Prerequisites

- **Playwright MCP server** for interactive browser control:
  ```bash
  claude mcp add playwright -- npx @playwright/mcp@latest
  ```
  Restart the session afterward so the `browser_*` tools register. Prefer
  `browser_snapshot` (accessibility tree) over screenshots for locating and
  acting on elements; use screenshots for the design review.
- **Both servers running.** Start them with `./dev.sh` (Vite on :5173, Django
  on :8000). Confirm before starting:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/auth/me/   # expect 401
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/                # expect 200
  ```
- Optional: `@axe-core/playwright` if you want automated WCAG scans.

## Ground rules

- **Don't touch existing local data.** Register fresh test users through the UI
  and create a dedicated space (e.g. "QA Family"). Space membership is the
  isolation boundary, so new users only ever see their own space.
- **Two users.** Register a second user to exercise the invite flow, the
  "paid by" selector, and data-isolation checks. Playwright MCP tabs/contexts
  or sequential logins both work.
- **Seed a known dataset** so report/dashboard math can be verified exactly
  (e.g. one salary + a handful of categorized expenses across several days).
- **Clean up after.** The run produces throwaway artifacts — `.playwright-mcp/`,
  `*.png` screenshots, any generated report HTML. Delete them before
  committing; they are not part of the repo.

## The pass

Work feature by feature; after each, note bugs with repro steps.

1. **Auth** — register (field validation, weak/mismatched password, duplicate
   email), login (bad credentials must show an inline error, not reload),
   logout, private-route redirect to `/login`, and **session survival across
   several page reloads** (the access token is memory-only, so each reload
   triggers a silent refresh — reload 2–3× to catch refresh-rotation bugs).
2. **Spaces** — create with a currency, confirm default categories appear,
   rename, change currency and confirm amounts reformat everywhere; invite flow
   end to end as the second user (accept, roles, isolation); space switching.
3. **Categories** — CRUD, and the delete-with-transactions case (expect a 409
   with a clear message).
4. **Transactions** — add/edit/delete income and expense, month navigation,
   category filter, decimal/zero/negative/over-limit amounts, empty states.
5. **Recurring** — one per frequency; run the generator and verify rows appear:
   ```bash
   cd backend && uv run python manage.py generate_recurring_transactions --settings=config.settings.local
   ```
   Check pause/resume and next-due advancement.
6. **Reports** — cross-check week/month/year donut totals and percentages
   against the seeded data to the cent; empty-period state.
7. **Dashboard** — all four widgets against known data, correct sort order,
   negative-net rendering, empty state.
8. **Settings** — profile edit, read-only email, theme picker persistence
   across reload.

## Cross-cutting checks

- **Design/UX** — screenshot every page at 1440 / 768 / 375 px in both light
  and dark themes. Check nav collapse to the mobile drawer, dialog adaptation,
  consistency of spacing/typography, and loading/empty/error/toast states.
- **Robustness** — XSS payloads in text fields (`<img onerror>` should render
  inert — React escapes), very long strings and emoji, over-limit amounts
  (`DecimalField(max_digits=10)` → max 99,999,999.99), double-submit, browser
  back button, deep-route refresh.
- **Data isolation** — as a non-member, probe another space's resources; expect
  403/404, never data. Verify object-level access too (fetch a transaction ID
  from a space you don't belong to) and that unauthenticated requests are 401:
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/token/ \
    -H "Content-Type: application/json" \
    -d '{"email":"USER","password":"PASS"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access'])")
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/api/budgets/transactions/?space_id=OTHER" \
    -H "Authorization: Bearer $TOKEN"   # expect 403
  ```
- **Console hygiene** — no stray JS errors on any page. Expected 4xx responses
  from negative tests are fine; unexpected errors are not.
- **Accessibility** — keyboard-only walkthrough, Escape closes dialogs, focus
  trap in Radix dialogs, form labels associated, `autocomplete` on auth inputs,
  contrast in both themes.

## Deliverable

Findings ranked by severity, each with repro steps and (for UI issues) a
screenshot. Then delete the artifacts and, if fixing, add regression tests
(`backend/tests/`, `frontend/**/__tests__/`) so the bug can't return.
