# Family Budget — Django Backend Design

**Date:** 2026-03-31
**Scope:** Backend only (Django REST API). React frontend and Playwright e2e tests are separate phases.

---

## Overview

A Django REST API backing a family budget app. Multiple family members share one household, track expenses together, and view spending reports. Each person has their own account; a household groups them. Recurring expenses auto-generate real expense entries via a management command.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Language | Python 3.12 |
| Framework | Django 5.x |
| API | Django REST Framework (DRF) |
| Auth | JWT via `djangorestframework-simplejwt` |
| Database | PostgreSQL |
| Package manager | `uv` (pyproject.toml + uv.lock) |
| CORS | `django-cors-headers` |
| Config | `django-environ` (secrets via `.env`) |

GraphQL is explicitly deferred — REST only for this phase.

---

## Project Structure

```
backend/
  manage.py
  pyproject.toml          ← all dependencies + dev dependencies
  uv.lock                 ← committed lockfile
  .python-version         ← pins Python version for uv
  .env.example            ← template for local secrets (never commit .env)
  config/
    __init__.py
    settings/
      __init__.py
      base.py             ← shared settings
      local.py            ← dev overrides (DEBUG=True, etc.)
      production.py       ← production overrides
    urls.py               ← root URL conf
    wsgi.py
  apps/
    accounts/             ← User model, registration, JWT auth
    households/           ← Household, membership, invites
    budgets/              ← Categories, expenses, recurring expenses, reports
```

---

## Django Apps

### `accounts`
Owns the custom User model and authentication endpoints.

- Custom `User` extends `AbstractUser`
- Email is the login field (`USERNAME_FIELD = "email"`), username is disabled
- Registration, token obtain/refresh/blacklist endpoints

### `households`
Owns the family grouping concept.

- A user can belong to one household at a time (enforced at the API layer)
- Household owner can invite others via email or a shareable link
- Membership roles: `owner` or `member`

### `budgets`
Owns all financial data.

- Categories are household-scoped (not global) so each family can customise them
- Expenses are always linked to a household, a category, and the user who paid
- Recurring expenses are templates — a management command generates real `Expense` rows and advances `next_due_date`
- Reports are computed on the fly from `Expense` rows (no pre-aggregated tables at this stage)

---

## Data Models

### `accounts.User`
```
email           — unique, login field
display_name    — shown in household UI
password        — hashed by Django
created_at
```

### `households.Household`
```
name
created_by      → User
created_at
```

### `households.HouseholdMembership`
```
household       → Household
user            → User (unique together with household)
role            — owner | member
joined_at
```

### `households.HouseholdInvite`
```
household       → Household
invited_by      → User
email           — nullable; if null, the invite is an open link (anyone with token can join)
token           — UUID4, used in invite URL
status          — pending | accepted | expired | revoked
expires_at
```

Two invite modes:
- **Email invite**: `email` is set — only that address may accept
- **Direct link invite**: `email` is null — shareable link, owner can revoke anytime

### `budgets.Category`
```
household       → Household
name
icon            — emoji or slug (e.g. "🍎" or "food")
is_income       — bool; separates income sources from expense categories
```

### `budgets.Expense`
```
household       → Household
category        → Category
amount          — DecimalField(10, 2)
date            — DateField
paid_by         → User
notes           — optional text
created_by      → User
created_at
```

### `budgets.RecurringExpense`
```
household       → Household
category        → Category
amount          — DecimalField(10, 2)
description
frequency       — weekly | monthly | yearly
start_date
next_due_date   — advanced by management command after each generation
is_active       — bool; deactivating stops generation without deleting history
```

The management command (`generate_recurring_expenses`) runs daily (via system cron or similar). It queries all active `RecurringExpense` rows where `next_due_date <= today`, creates an `Expense` for each, and advances `next_due_date` by the frequency interval.

---

## API Endpoints

All endpoints except auth require a valid JWT `Authorization: Bearer <token>` header. All data is automatically scoped to the authenticated user's household — no cross-household data is accessible.

### Auth (`/api/auth/`)
```
POST   /api/auth/register/             ← create account (email + password + display_name)
POST   /api/auth/token/                ← login → returns access + refresh tokens
POST   /api/auth/token/refresh/        ← exchange refresh token for new access token
POST   /api/auth/token/blacklist/      ← logout (invalidates refresh token)
```

### Households (`/api/households/`)
```
POST   /api/households/                       ← create a new household (caller becomes owner)
GET    /api/households/me/                    ← current user's household + members
POST   /api/households/invites/               ← create invite (email or open link)
POST   /api/households/invites/accept/        ← accept invite by token
DELETE /api/households/invites/{id}/          ← revoke an invite (owner only)
```

### Categories (`/api/categories/`)
```
GET    /api/categories/
POST   /api/categories/
PUT    /api/categories/{id}/
DELETE /api/categories/{id}/
```

### Expenses (`/api/expenses/`)
```
GET    /api/expenses/          ← supports ?month=2026-03 and ?category={id}
POST   /api/expenses/
PUT    /api/expenses/{id}/
DELETE /api/expenses/{id}/
```

### Recurring Expenses (`/api/recurring-expenses/`)
```
GET    /api/recurring-expenses/
POST   /api/recurring-expenses/
PUT    /api/recurring-expenses/{id}/
DELETE /api/recurring-expenses/{id}/
```

### Reports (`/api/reports/`)
```
GET    /api/reports/monthly-summary/?month=2026-03
GET    /api/reports/weekly-summary/?week=2026-03-30
GET    /api/reports/yearly-summary/?year=2026
```

All three report endpoints return spending totals per category for the given period. `week` param is the start date of the week; the backend computes `[date, date + 6 days]`.

---

## Key Design Decisions

**Email as login field.** Cleaner than usernames for a family app. `AbstractUser` is extended with `USERNAME_FIELD = "email"`.

**Household-scoped categories.** Each household defines its own categories rather than sharing a global list. This avoids pollution between households and lets families customise (e.g. add "Piano lessons" as a category).

**Invite token is a UUID.** No sequential IDs in invite URLs — tokens are unguessable. Expiry is enforced server-side.

**Open link invites (email=null).** Allows sharing via messaging apps without requiring the recipient's email upfront. Owner can revoke to invalidate the link.

**Recurring expenses as templates.** `RecurringExpense` rows are never shown directly in spending history — only the generated `Expense` rows are. This keeps the data model clean and reports simple.

**Reports computed on the fly.** No pre-aggregated tables. For an MVP with small household data volumes, a well-indexed query on `Expense` (by `household`, `date`) is fast enough.

**Settings split (base/local/production).** Teaches the correct pattern for managing environment-specific config without repeating shared settings.

---

## Out of Scope (This Phase)

- CategoryBudget (monthly spending limits per category)
- SavingsGoals
- Bank account linking / auto-import
- Social login (OAuth) — JWT only for now
- React frontend
- Playwright e2e tests
- Deployment / Docker / CI
