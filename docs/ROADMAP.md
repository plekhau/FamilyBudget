# FamilyBudget — Roadmap & Phase History

Current state of the project at a glance. **Update this file whenever a phase completes** (add the phase to Completed, adjust Next Up). Design specs live in [superpowers/specs/](superpowers/specs/), implementation plans in [superpowers/plans/](superpowers/plans/) — dated files, immutable records of what was decided and why.

## Completed phases

| Phase | Spec | Shipped |
|---|---|---|
| Backend API — accounts (JWT), spaces (memberships, invites), budgets (categories, transactions, recurring, reports) | [2026-03-31 backend design](superpowers/specs/2026-03-31-family-budget-backend-design.md) | 2026-04 |
| Frontend Phase 1 — auth (login/register), settings, app shell, theming | [2026-04-08 frontend design](superpowers/specs/2026-04-08-frontend-design.md) | 2026-04 |
| Frontend linting — Prettier, ESLint strict, husky/lint-staged | [2026-05-11 linting design](superpowers/specs/2026-05-11-frontend-linting-design.md) | 2026-05 |
| Spaces frontend — space management, invites, accept-invite flow | [2026-05-11 spaces design](superpowers/specs/2026-05-11-spaces-frontend-design.md) | 2026-05 |
| UX polish — toasts, tooltips, avatars, skeletons, spacing | [2026-05-12 UX design](superpowers/specs/2026-05-12-frontend-ux-improvements-design.md) | 2026-05 |
| Nav icon resize | [2026-05-12 nav icon design](superpowers/specs/2026-05-12-nav-icon-resize-design.md) | 2026-05 |
| GitHub Actions CI — backend + frontend test/lint jobs, path-filtered | [2026-06-16 CI design](superpowers/specs/2026-06-16-github-actions-ci-design.md) | 2026-06 |
| Budget section + per-space currency — Transactions, Categories, Recurring, Reports pages; `Space.currency`, `PATCH /api/spaces/{id}/`, category-delete 409 | [2026-07-02 budget design](superpowers/specs/2026-07-02-budget-frontend-design.md) | 2026-07 |
| Budget section UX polish — totals, chart legend, locale setting, comma amounts, Today button | [2026-07-03 budget UX improvements design](superpowers/specs/2026-07-03-budget-ux-improvements-design.md) | 2026-07 |

## Next up (no spec yet)

- **Dashboard page** — the rail icon exists but points at a `ComingSoon` stub. Likely wants report widgets + recent transactions.
- **Playwright e2e tests** — `tests/` is empty; CLAUDE.md marks it planned. CI job for it deferred in the CI spec.

## Backlog (deferred by earlier specs, in no order)

- Member management: remove member, change role, leave space (no backend endpoints)
- Invite listing/revocation UI (backend revoke endpoint exists, no list endpoint)
- Space rename UI (backend `PATCH` supports `name` since the currency phase; no UI exposes it)
- Per-category budget limits, savings goals
- Password reset, OAuth login
- Deployment (Docker, hosting)
- CI "all-green" gate job (needed only if branch protection turns on required checks)

## Research inputs

`tmp/deep-research-report-overall.md` and `tmp/deep-research-report-budget.md` — competitive analysis and budget-UX research (entry friction, categorization, reports). Informed the budget phase; voice entry / OCR / bank sync ideas from them remain out of scope.
