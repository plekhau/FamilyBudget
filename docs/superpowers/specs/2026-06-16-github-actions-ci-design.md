# GitHub Actions CI for FamilyBudget — Design

**Date:** 2026-06-16
**Status:** Approved

## Goal

Run the backend (Django/pytest) and frontend (Vitest) test suites automatically
on GitHub, plus lint/format gates for both, so regressions are caught on every
pull request and on pushes to `main`.

## Context

FamilyBudget is a two-package monorepo with no root-level test runner:

- `backend/` — Django REST Framework, Python 3.12, managed with `uv` (`uv.lock`
  committed). Pytest config lives in `backend/pyproject.toml`
  (`DJANGO_SETTINGS_MODULE = "config.settings.local"`). Lint/format tooling
  already present: `black`, `isort`, `flake8`.
- `frontend/` — React 19 + Vite 6/8 + Vitest 4, managed with `pnpm`
  (`pnpm-lock.yaml` v9 committed). Test config lives in `vite.config.ts`.

There are currently **no** GitHub Actions workflows.

Two pre-existing gaps this design also closes:

1. `frontend/package.json` has **no `test` script**, despite CLAUDE.md documenting
   `pnpm test`. CI (and local devs) need a stable test command.
2. `frontend/package.json` has **no `packageManager` field**, so
   `pnpm/action-setup` would have no pnpm version to pin.

## Decisions

| Decision | Choice |
| --- | --- |
| Backend test database | Postgres service container (`postgres:16`) — matches production / `.env.example` |
| Workflow structure | Single workflow file, two parallel path-filtered jobs |
| Triggers | `pull_request` (any branch) + `push` to `main` |
| Frontend extra checks | eslint (`pnpm lint`) + prettier (`pnpm format:check`) |
| Backend extra checks | `black --check`, `isort --check-only`, `flake8` |
| Source changes | Add `test`/`test:run` scripts + `packageManager` to `frontend/package.json` |

## Architecture

A single workflow file: `.github/workflows/ci.yml`.

### Triggers

```yaml
on:
  push:
    branches: [main]
  pull_request:
```

Runs on every PR and on direct pushes to `main`. Avoids double-runs on feature
branches that also have an open PR.

### Path filtering

Both jobs live in one workflow, so a workflow-level `paths:` filter cannot target
individual jobs. A lightweight `changes` job uses `dorny/paths-filter@v3` to
detect whether `backend/**` or `frontend/**` changed and exposes the result as
job outputs. The `backend` and `frontend` jobs each gate on the relevant output:

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
              - '.github/workflows/ci.yml'
            frontend:
              - 'frontend/**'
              - '.github/workflows/ci.yml'
  backend:
    needs: changes
    if: ${{ needs.changes.outputs.backend == 'true' }}
    ...
  frontend:
    needs: changes
    if: ${{ needs.changes.outputs.frontend == 'true' }}
    ...
```

A change to the workflow file itself triggers both jobs (so the workflow is
self-testing).

> **Caveat — required status checks:** path-filtered jobs report as *skipped*
> (not *success*) when their area didn't change. If branch protection later
> requires these checks, "skipped" can block merges. When/if that is enabled,
> add a final "all-green" gate job that depends on both and succeeds when they
> either pass or are skipped. Not implemented now.

### Job: `backend`

- `runs-on: ubuntu-latest`, all steps run with `working-directory: backend`.
- **Service container:** `postgres:16` with a health-check, port `5432` exposed.
- **Environment:**
  - `DATABASE_URL=postgres://postgres:postgres@localhost:5432/familybudget`
  - `SECRET_KEY=ci-secret-key`
- **Steps:**
  1. `actions/checkout@v4`
  2. `astral-sh/setup-uv@v5` with `enable-cache: true`, `python-version: "3.12"`
  3. `uv sync --frozen`
  4. `uv run black --check .`
  5. `uv run isort --check-only .`
  6. `uv run flake8 .`
  7. `uv run pytest`

`pytest-django` creates and destroys its own `test_*` database against the
Postgres service. `config/settings/local.py` calls `environ.Env.read_env()` on a
`.env` path that does not exist in CI; django-environ treats a missing file as a
no-op, so the CI-provided environment variables are used. `SECRET_KEY` also has a
default in `local.py`, but it is set explicitly for clarity.

### Job: `frontend`

- `runs-on: ubuntu-latest`, all steps run with `working-directory: frontend`.
- **Steps:**
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` with `package_json_file: frontend/package.json`
     (pnpm version read from that file's `packageManager` field)
  3. `actions/setup-node@v4` with `node-version: "22"`, `cache: pnpm`,
     `cache-dependency-path: frontend/pnpm-lock.yaml`
  4. `pnpm install --frozen-lockfile`
  5. `pnpm lint`
  6. `pnpm format:check`
  7. `pnpm test:run`

`pnpm/action-setup` runs before `setup-node` because the Node pnpm cache requires
pnpm to already be installed. Because `uses:` steps ignore
`defaults.run.working-directory` (it applies only to `run:` steps), the action
runs from the repository root, so `package_json_file` must point explicitly at
`frontend/package.json` for the `packageManager` field to be found. Node 22 is
used because GitHub deprecated Node 20 on Actions runners.

## Source changes

`frontend/package.json`:

```json
{
  "packageManager": "pnpm@10.33.0",
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

(`scripts` shown as additions; existing scripts are kept.) `test` enables the
documented `pnpm test` watch-mode locally; `test:run` is the single-run command
CI uses. `packageManager` pins pnpm for `pnpm/action-setup`.

## Testing / verification

- After adding the workflow, confirm `pnpm test:run` and `pnpm lint`/`format:check`
  pass locally from `frontend/`.
- Confirm `uv run pytest` and the three lint/format commands pass locally from
  `backend/` (against the developer's own DB).
- Push to a branch and open a PR; verify both jobs run, the right jobs are
  skipped on area-scoped changes, and all steps pass.

## Out of scope

- Deployment / publishing.
- Coverage reporting / thresholds.
- Branch-protection configuration and the "all-green" gate job (deferred until
  required checks are enabled).
- End-to-end Playwright tests (not yet present in the repo).
