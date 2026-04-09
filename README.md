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

