# FamilyBudget
Pet project for full-stack experience

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

