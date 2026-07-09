# FamilyBudget
Pet project for full-stack experience

## Stack

- **Backend** — Django REST Framework, JWT auth, SQLite (dev)
- **Frontend** — React 19, Vite 6, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, Zustand

## Backend

### Setup

```bash
cd backend

# Create and activate virtual environment
uv venv
source .venv/bin/activate

# Install dependencies
uv sync --group dev
```

### Database

```bash
# Apply migrations
uv run python manage.py migrate --settings=config.settings.local

# Create superuser
uv run python manage.py createsuperuser --settings=config.settings.local
```

### Run

```bash
uv run python manage.py runserver --settings=config.settings.local
```

### Tests

```bash
uv run pytest
```

### Linting & Formatting

```bash
uv run black .     # format code (120 char line length)
uv run isort .     # sort imports
uv run flake8 .    # lint
```

## Frontend

### Setup

```bash
cd frontend
pnpm install
```

### Run

```bash
pnpm dev
```

Starts at `http://localhost:5173`. Requires the backend running on `http://localhost:8000`.

### Tests

```bash
pnpm test          # watch mode
pnpm test --run    # single run
```

### Linting & Formatting

```bash
pnpm lint          # lint
pnpm lint:fix      # lint + auto-fix
pnpm format        # format src/ (Prettier + Tailwind class sorting)
pnpm format:check  # CI check
```

Pre-commit hooks run automatically via husky + lint-staged on every commit.

## Development

Everything needed to run a fully working local instance.

### One-time setup

1. **Backend environment** — create `backend/.env` from the example and point it at SQLite for local dev:

   ```bash
   cd backend
   cp .env.example .env
   # then edit .env: DATABASE_URL=sqlite:///db.sqlite3
   ```

2. **Install dependencies and prepare the database** — follow [Backend → Setup](#setup) and [Backend → Database](#database), then [Frontend → Setup](#setup-1).

### Running the app

Two processes, in separate terminals:

```bash
# Terminal 1 — API on http://localhost:8000
cd backend
uv run python manage.py runserver --settings=config.settings.local

# Terminal 2 — web app on http://localhost:5173
cd frontend
pnpm dev
```

### Recurring transactions (scheduled job)

Creating or editing a recurring transaction in the UI immediately generates any already-due
transactions. **Future occurrences, however, are only materialized by a management command that
must run at least once a day:**

```bash
cd backend
uv run python manage.py generate_recurring_transactions --settings=config.settings.local
```

A single run catches up on all missed periods, so it is safe if your machine was off for a while —
the next run will backfill every missed occurrence.

To automate it with cron (macOS/Linux), run `crontab -e` and add:

```cron
0 9 * * * cd /path/to/FamilyBudget/backend && /full/path/to/uv run python manage.py generate_recurring_transactions --settings=config.settings.local >> /tmp/familybudget-recurring.log 2>&1
```

Notes:

- Use the full path to `uv` (find it with `which uv`) — cron runs with a minimal `PATH`.
- On macOS, cron jobs are skipped while the machine sleeps; thanks to the catch-up behavior the
  next successful run will backfill anything missed.

