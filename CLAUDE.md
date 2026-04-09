# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FamilyBudget is a full-stack family budget tracking application consisting of:

- `backend/` — Django REST Framework API (implemented)
- `frontend/` — web frontend (planned)
- `tests/` — end-to-end Playwright tests (planned)

## Commands

All commands run from `backend/` using `uv`:

```bash
# Run dev server
uv run python manage.py runserver --settings=config.settings.local

# Run all tests
uv run pytest

# Run a single test file
uv run pytest tests/budgets/test_transactions.py

# Run a single test
uv run pytest tests/budgets/test_transactions.py::TestClassName::test_method_name

# Apply migrations
uv run python manage.py migrate --settings=config.settings.local

# Make migrations
uv run python manage.py makemigrations --settings=config.settings.local

# Generate recurring transactions (management command)
uv run python manage.py generate_recurring_transactions --settings=config.settings.local
```

The `--settings` flag is only needed for management commands; pytest reads `DJANGO_SETTINGS_MODULE` from `pyproject.toml` automatically (`config.settings.local`).

## Architecture

### Apps

- **`apps/accounts`** — Custom `User` model (email-based, no username). JWT auth via `djangorestframework-simplejwt` with token blacklisting on refresh rotation.
- **`apps/spaces`** — Multi-tenant isolation unit. A `Space` has members via `SpaceMembership` (roles: owner/admin/member). Invites use UUID tokens with expiry.
- **`apps/budgets`** — Core budget data: `Category`, `Transaction`, `RecurringTransaction`. Reports live in `reports.py`.

### Multi-tenancy pattern

Every resource belongs to a `Space`. Views use `get_space_for_user(space_id, user)` (defined in `budgets/views.py`) to resolve and authorize the space — this raises `PermissionDenied` if the user is not a member. Space membership is the authorization boundary; there are no per-object DRF permissions beyond that.

Custom DRF permissions in `apps/spaces/permissions.py` (`IsSpaceMember`, `IsSpaceOwnerOrAdmin`, `IsSpaceOwner`) are available but currently used sparingly — the budget views use the `get_space_for_user` helper directly.

### Signals

`apps/budgets/signals.py`: When a `Space` is created, a `post_save` signal auto-creates default categories (from `default_categories.py`) for that space.

### Settings

`config/settings/base.py` — shared config, reads `DATABASE_URL` from env.  
`config/settings/local.py` — development: reads `backend/.env`, enables DEBUG, allows all CORS origins.  
`config/settings/production.py` — production overrides.

### API routes

```
/api/auth/          → apps.accounts.urls  (register, login, token refresh, logout)
/api/spaces/        → apps.spaces.urls    (spaces CRUD, memberships, invites)
/api/budgets/       → apps.budgets.urls   (categories, transactions, recurring, reports)
```

All endpoints require JWT authentication. Reports are at `/api/budgets/reports/<report_type>/` with `?space_id=&month=` (or `week=`/`year=`) params.

### Tests

Tests use `pytest-django` and `factory-boy`. The `conftest.py` in `tests/` provides `api_client` and `auth_client` fixtures. Tests hit a real SQLite database (configured via `local` settings); do not mock the DB.
