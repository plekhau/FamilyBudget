# Family Budget — Django Backend Design

**Date:** 2026-03-31  
**Updated:** 2026-04-01  
**Scope:** Backend only (Django REST API). React frontend and Playwright e2e tests are separate phases.

---

## Overview

A Django REST API backing a family budget app. Users belong to one or more **spaces** (shared budget groups). Members track transactions together and view spending reports. Recurring transactions auto-generate real transaction entries via a management command.

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
    spaces/               ← Space, membership, invites
    budgets/              ← Categories, transactions, recurring transactions, reports
```

---

## Django Apps

### `accounts`
Owns the custom User model and authentication endpoints.

- Custom `User` extends `AbstractUser`
- Email is the login field (`USERNAME_FIELD = "email"`), username is disabled
- Registration, token obtain/refresh/blacklist endpoints

### `spaces`
Owns the grouping concept.

- A user can belong to multiple spaces simultaneously
- Space owner can invite others via email or a shareable link
- Membership roles: `owner` | `admin` | `member`
  - `owner` — full control including deleting the space
  - `admin` — same as owner except cannot delete the space
  - `member` — can add/edit transactions, cannot manage members or invites

### `budgets`
Owns all financial data.

- Categories are space-scoped (not global) so each space can customise them
- A default set of categories is created automatically when a space is created
- Transactions are always linked to a space, a category, and the user who paid
- Recurring transactions are templates — a management command generates real `Transaction` rows and advances `next_due_date`
- Reports are computed on the fly from `Transaction` rows (no pre-aggregated tables at this stage)

---

## Data Models

### `accounts.User`
```
email           — unique, login field
display_name    — shown in space UI
password        — hashed by Django
created_at
```

### `spaces.Space`
```
name
created_by      → User
created_at
```

### `spaces.SpaceMembership`
```
space           → Space
user            → User
role            — owner | admin | member
joined_at
```
A user may have memberships in multiple spaces (no unique constraint on `user` alone — only `unique_together: (space, user)`).

### `spaces.SpaceInvite`
```
space           → Space
invited_by      → User
email           — nullable; if null, the invite is an open link (anyone with token can join)
token           — UUID4, used in invite URL
status          — pending | accepted | expired | revoked
expires_at
```

Two invite modes:
- **Email invite**: `email` is set — only that address may accept
- **Direct link invite**: `email` is null — shareable link, owner/admin can revoke anytime

### `budgets.Category`
```
space           → Space
name
icon            — emoji (e.g. "🏠")
is_income       — bool; separates income sources from expense categories
```

**Default categories** created automatically on space creation via a `post_save` signal:

| Icon | Name | is_income |
|---|---|---|
| 🏠 | Housing | false |
| 🛒 | Groceries | false |
| 🚗 | Transportation | false |
| 🍽️ | Dining Out | false |
| 💡 | Utilities | false |
| 🏥 | Healthcare | false |
| 🎬 | Entertainment | false |
| 👕 | Clothing | false |
| 💰 | Salary | true |
| 💸 | Other Income | true |
| 📦 | Other | false |

Users can rename, delete, or add categories after creation.

### `budgets.Transaction`
```
space           → Space
category        → Category
amount          — DecimalField(10, 2)
date            — DateField
paid_by         → User
notes           — optional text
created_by      → User
created_at
```

Covers both expenses and income — distinguished by the category's `is_income` flag.

### `budgets.RecurringTransaction`
```
space           → Space
category        → Category
amount          — DecimalField(10, 2)
description
frequency       — weekly | monthly | yearly
start_date
next_due_date   — advanced by management command after each generation
is_active       — bool; deactivating stops generation without deleting history
```

The management command (`generate_recurring_transactions`) runs daily (via system cron or similar). It queries all active `RecurringTransaction` rows where `next_due_date <= today`, creates a `Transaction` for each, and advances `next_due_date` by the frequency interval.

---

## API Endpoints

All endpoints except auth require a valid JWT `Authorization: Bearer <token>` header. All data is scoped to a specific space (passed as part of the URL or resolved from context) — no cross-space data is accessible.

### Auth (`/api/auth/`)
```
POST   /api/auth/register/             ← create account (email + password + display_name)
POST   /api/auth/token/                ← login → returns access + refresh tokens
POST   /api/auth/token/refresh/        ← exchange refresh token for new access token
POST   /api/auth/token/blacklist/      ← logout (invalidates refresh token)
```

### Spaces (`/api/spaces/`)
```
GET    /api/spaces/                           ← list all spaces the user belongs to
POST   /api/spaces/                           ← create a new space (caller becomes owner)
GET    /api/spaces/{id}/                      ← space detail + members
DELETE /api/spaces/{id}/                      ← delete space (owner only)
POST   /api/spaces/{id}/invites/              ← create invite (email or open link)
POST   /api/spaces/invites/accept/            ← accept invite by token
DELETE /api/spaces/{id}/invites/{invite_id}/  ← revoke an invite (owner or admin)
```

### Categories (`/api/budgets/categories/`)
```
GET    /api/budgets/categories/?space_id=123
POST   /api/budgets/categories/                    ← space_id in body
PUT    /api/budgets/categories/{id}/
DELETE /api/budgets/categories/{id}/
```

### Transactions (`/api/budgets/transactions/`)
```
GET    /api/budgets/transactions/?space_id=123&month=2026-03&category_id=5
POST   /api/budgets/transactions/                  ← space_id in body
PUT    /api/budgets/transactions/{id}/
DELETE /api/budgets/transactions/{id}/
```

### Recurring Transactions (`/api/budgets/recurring-transactions/`)
```
GET    /api/budgets/recurring-transactions/?space_id=123
POST   /api/budgets/recurring-transactions/        ← space_id in body
PUT    /api/budgets/recurring-transactions/{id}/
DELETE /api/budgets/recurring-transactions/{id}/
```

### Reports (`/api/budgets/reports/`)
```
GET    /api/budgets/reports/monthly-summary/?space_id=123&month=2026-03
GET    /api/budgets/reports/weekly-summary/?space_id=123&week=2026-03-30
GET    /api/budgets/reports/yearly-summary/?space_id=123&year=2026
```

All three report endpoints return totals per category for the given period. `week` param is the start date of the week; the backend computes `[date, date + 6 days]`. For `PUT`/`DELETE` the space is inferred from the resource itself.

---

## Key Design Decisions

**Email as login field.** Cleaner than usernames for a family app. `AbstractUser` is extended with `USERNAME_FIELD = "email"`.

**Users belong to multiple spaces.** `SpaceMembership` has `unique_together: (space, user)` but no constraint on user alone — one user can be a member of multiple spaces.

**Three-role membership.** `owner` can delete the space; `admin` has all other owner capabilities (manage members, revites); `member` can only manage transactions. This keeps admin delegation practical without overcomplicating permissions.

**Space-scoped categories with defaults.** Each space gets a standard set of categories on creation via a `post_save` signal. Users can modify freely. Avoids a shared global list that would pollute between spaces.

**Transaction covers income and expenses.** The `is_income` flag on `Category` distinguishes direction. No need for a separate model.

**Invite token is a UUID.** No sequential IDs in invite URLs — tokens are unguessable. Expiry is enforced server-side.

**Open link invites (email=null).** Allows sharing via messaging apps without requiring the recipient's email upfront. Owner/admin can revoke to invalidate the link.

**Recurring transactions as templates.** `RecurringTransaction` rows are never shown directly in transaction history — only the generated `Transaction` rows are. This keeps the data model clean and reports simple.

**Reports computed on the fly.** No pre-aggregated tables. For an MVP with small space data volumes, a well-indexed query on `Transaction` (by `space`, `date`) is fast enough.

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
