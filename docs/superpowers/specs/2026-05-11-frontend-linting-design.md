# Frontend Linting & Formatting Design

**Date:** 2026-05-11  
**Project:** FamilyBudget — `frontend/`  
**Status:** Approved

## Goal

Bring the frontend up to the same linting/formatting standard as the backend (black + isort + flake8), using the React/TypeScript ecosystem equivalents.

## What's Already in Place

- ESLint 9 (flat config) with `@eslint/js`, `typescript-eslint` recommended, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- A `lint` script in `package.json`
- TypeScript strict flags (`noUnusedLocals`, `noUnusedParameters`, etc.)

## Additions

### 1. Prettier

**Packages:** `prettier`, `prettier-plugin-tailwindcss`

**`.prettierrc`** at `frontend/`:
```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 120,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- `printWidth: 120` matches the backend line length.
- `prettier-plugin-tailwindcss` automatically sorts Tailwind class names on every format.

**`.prettierignore`** at `frontend/`:
```
dist
node_modules
pnpm-lock.yaml
```

### 2. ESLint Upgrades

**Package:** `eslint-config-prettier`

Update `eslint.config.js`:
- Replace `tseslint.configs.recommended` with `tseslint.configs.strict` and `tseslint.configs.stylistic` for tighter type-safety and style consistency.
- Add `eslint-config-prettier` as the final extend to disable all ESLint rules that conflict with Prettier's formatting.

### 3. Pre-commit Enforcement

**Packages:** `husky`, `lint-staged`

A pre-commit hook runs lint-staged on staged files only:

```json
"lint-staged": {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,css,md}": ["prettier --write"]
}
```

Husky is initialized via `husky init` which creates `.husky/pre-commit`.

### 4. New Scripts

Added to `package.json`:

| Script | Command |
|--------|---------|
| `format` | `prettier --write src` |
| `format:check` | `prettier --check src` |
| `lint:fix` | `eslint . --fix` |

Existing `"lint": "eslint ."` is unchanged.

## File Changes Summary

| File | Change |
|------|--------|
| `frontend/package.json` | Add dev deps, new scripts, lint-staged config |
| `frontend/.prettierrc` | New — Prettier config |
| `frontend/.prettierignore` | New — Prettier ignore |
| `frontend/eslint.config.js` | Upgrade to strict + stylistic, add prettier compat |
| `frontend/.husky/pre-commit` | New — runs lint-staged |
| `frontend/pnpm-lock.yaml` | Updated by pnpm |
