# Budget Section Frontend + Space Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four Budget `ComingSoon` stubs (Transactions, Categories, Recurring, Reports) with working pages, and add per-space currency (chosen at space creation, editable by owner/admin, displayed as a bare symbol on every amount).

**Architecture:** Mostly frontend, following the existing feature patterns (TanStack Query hooks, shadcn dialogs, sonner toasts, MSW-backed Vitest tests). A small backend slice adds `Space.currency`, a `PATCH /api/spaces/{id}/` endpoint, and converts the category-delete `ProtectedError` into a 409. Spec: `docs/superpowers/specs/2026-07-02-budget-frontend-design.md`.

**Tech Stack:** Django 5 + DRF (backend), React 19 + TypeScript + TanStack Query v5 + Zustand + Tailwind v4 + shadcn/ui + Recharts (frontend), pytest / Vitest + RTL + MSW (tests).

## Global Constraints

- Backend commands run from `backend/` with `uv`; frontend commands run from `frontend/` with `pnpm`.
- Before every **backend** commit: `uv run black . && uv run isort . && uv run flake8 .` (CI gates on these).
- Before every **frontend** commit: `pnpm lint:fix && pnpm format` (CI gates on `pnpm lint` and `pnpm format:check`).
- Every test has a docstring. No imports inside test functions — imports go at the top of the file.
- TDD for every task: write the failing test first, watch it fail, implement, watch it pass, commit.
- Currency is always displayed as a bare symbol (`$84.20`, `€84.20`) via `Intl.NumberFormat` with `currencyDisplay: 'narrowSymbol'`. ISO codes (`USD`) never appear in UI copy.
- Weeks start on **Monday** (ISO 8601).
- Amounts from the API are decimal **strings** (`"84.20"`).
- Form `<select>` elements use the shared `NativeSelect` component (native selects are testable in jsdom and give native pickers in mobile WebViews). Radix components are used only for Dialog, Switch, Tabs, DropdownMenu.
- Forms carry `noValidate` (project convention — see CLAUDE.md).
- All frontend page tests render with `QueryClientProvider` (retries off) + `MemoryRouter`, set `useAuthStore`/`useSpaceStore` state directly, and reset both stores in `afterEach` (copy the pattern from `src/features/spaces/__tests__/SpacesPage.test.tsx`).

---

### Task 1: Backend — `Space.currency` field

**Files:**
- Modify: `backend/apps/spaces/models.py` (Space model)
- Modify: `backend/apps/spaces/serializers.py` (SpaceSerializer)
- Create: `backend/apps/spaces/migrations/0002_space_currency.py` (generated)
- Test: `backend/tests/spaces/test_currency.py`

**Interfaces:**
- Consumes: existing `Space` model, `SpaceSerializer`, `auth_client` fixture.
- Produces: `Space.currency: CharField(max_length=3, default="USD")`; `SpaceSerializer` accepts and returns `currency` (uppercased, validated 3 alpha chars). All later tasks rely on `currency` being present in every space API response.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/spaces/test_currency.py`:

```python
import pytest


@pytest.mark.django_db
class TestSpaceCurrency:
    def test_create_space_with_currency(self, auth_client):
        """Creating a space with an explicit currency stores and returns it."""
        response = auth_client.post("/api/spaces/", {"name": "Euro Home", "currency": "EUR"})
        assert response.status_code == 201
        assert response.data["currency"] == "EUR"

    def test_create_space_defaults_to_usd(self, auth_client):
        """Creating a space without a currency defaults to USD."""
        response = auth_client.post("/api/spaces/", {"name": "Plain Home"})
        assert response.status_code == 201
        assert response.data["currency"] == "USD"

    def test_currency_is_uppercased(self, auth_client):
        """A lowercase currency code is normalized to uppercase."""
        response = auth_client.post("/api/spaces/", {"name": "Lower", "currency": "eur"})
        assert response.status_code == 201
        assert response.data["currency"] == "EUR"

    def test_currency_must_be_three_letters(self, auth_client):
        """A currency code that is not exactly 3 alphabetic characters is rejected with 400."""
        for bad in ("EURO", "E1R", "€"):
            response = auth_client.post("/api/spaces/", {"name": "Bad", "currency": bad})
            assert response.status_code == 400

    def test_list_spaces_includes_currency(self, auth_client):
        """Listing spaces includes each space's currency."""
        auth_client.post("/api/spaces/", {"name": "Home", "currency": "PLN"})
        response = auth_client.get("/api/spaces/")
        assert response.data[0]["currency"] == "PLN"
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/spaces/test_currency.py -v`
Expected: FAIL — `KeyError: 'currency'` (field not in response).

- [ ] **Step 3: Add the model field and migration**

In `backend/apps/spaces/models.py`, add to `Space` after `name`:

```python
    currency = models.CharField(max_length=3, default="USD")
```

Generate the migration:

```bash
uv run python manage.py makemigrations spaces --settings=config.settings.local
uv run python manage.py migrate --settings=config.settings.local
```

Expected: creates `backend/apps/spaces/migrations/0002_space_currency.py`.

- [ ] **Step 4: Add the serializer field + validation**

In `backend/apps/spaces/serializers.py`, update `SpaceSerializer`:

```python
class SpaceSerializer(serializers.ModelSerializer):
    members = SpaceMembershipSerializer(source="memberships", many=True, read_only=True)

    class Meta:
        model = Space
        fields = ("id", "name", "currency", "created_at", "members")
        read_only_fields = ("id", "created_at", "members")

    def validate_currency(self, value):
        value = value.upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Currency must be a 3-letter code.")
        return value
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/spaces/ -v`
Expected: all PASS (new tests + existing spaces tests).

- [ ] **Step 6: Lint and commit**

```bash
uv run black . && uv run isort . && uv run flake8 .
git add apps/spaces tests/spaces/test_currency.py
git commit -m "feat(backend): add currency field to Space"
```

---

### Task 2: Backend — `PATCH /api/spaces/{id}/` (owner/admin)

**Files:**
- Modify: `backend/apps/spaces/views.py` (`SpaceDetailView`)
- Test: `backend/tests/spaces/test_space_update.py`

**Interfaces:**
- Consumes: `SpaceSerializer` with `currency` (Task 1), `IsSpaceOwnerOrAdmin` / `IsSpaceOwner` from `apps/spaces/permissions.py`.
- Produces: `PATCH /api/spaces/{id}/` accepting partial `{name?, currency?}`, returning the updated space. 403 for `member` role, 404 for non-members (queryset-scoped). Frontend Task 9 calls this endpoint.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/spaces/test_space_update.py`:

```python
import pytest

from apps.accounts.models import User
from apps.spaces.models import Space, SpaceMembership


@pytest.mark.django_db
class TestSpaceUpdate:
    def _space_with_second_user(self, auth_client, role):
        """Create a space owned by auth_client's user plus a second user with the given role."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        other = User.objects.create_user(
            email="second@example.com", password="testpass123", display_name="Second"
        )
        SpaceMembership.objects.create(space_id=space_id, user=other, role=role)
        return space_id, other

    def test_owner_can_update_currency(self, auth_client):
        """The space owner can PATCH the currency and receives the updated value."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"currency": "EUR"})
        assert response.status_code == 200
        assert response.data["currency"] == "EUR"

    def test_owner_can_rename_space(self, auth_client):
        """The space owner can PATCH the name."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"name": "New Name"})
        assert response.status_code == 200
        assert response.data["name"] == "New Name"

    def test_admin_can_update_currency(self, auth_client, api_client):
        """A space admin (not owner) can PATCH the currency."""
        space_id, admin = self._space_with_second_user(auth_client, SpaceMembership.Role.ADMIN)
        api_client.force_authenticate(user=admin)
        response = api_client.patch(f"/api/spaces/{space_id}/", {"currency": "GBP"})
        assert response.status_code == 200
        assert response.data["currency"] == "GBP"

    def test_member_cannot_update_space(self, auth_client, api_client):
        """A plain member gets 403 when PATCHing the space."""
        space_id, member = self._space_with_second_user(auth_client, SpaceMembership.Role.MEMBER)
        api_client.force_authenticate(user=member)
        response = api_client.patch(f"/api/spaces/{space_id}/", {"currency": "GBP"})
        assert response.status_code == 403

    def test_non_member_cannot_update_space(self, auth_client, api_client):
        """A user outside the space gets 404 when PATCHing it."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        outsider = User.objects.create_user(
            email="outsider@example.com", password="testpass123", display_name="Out"
        )
        api_client.force_authenticate(user=outsider)
        response = api_client.patch(f"/api/spaces/{space_id}/", {"currency": "GBP"})
        assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/spaces/test_space_update.py -v`
Expected: FAIL — 405 Method Not Allowed (view is `RetrieveDestroyAPIView`).

- [ ] **Step 3: Implement the endpoint**

In `backend/apps/spaces/views.py`:

1. Change the import line to include `IsSpaceOwnerOrAdmin`:

```python
from .permissions import IsSpaceOwner, IsSpaceOwnerOrAdmin
```

2. Change `SpaceDetailView` to allow partial update:

```python
class SpaceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SpaceSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Space.objects.filter(memberships__user=self.request.user).prefetch_related("memberships__user")

    def destroy(self, request, *args, **kwargs):
        space = self.get_object()
        self.check_object_permissions(request, space)
        space.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [permissions.IsAuthenticated(), IsSpaceOwner()]
        if self.request.method == "PATCH":
            return [permissions.IsAuthenticated(), IsSpaceOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]
```

(`http_method_names` excludes `put` — the API is PATCH-only for spaces. `get_object()` inside DRF's `partial_update` runs `check_object_permissions`, which invokes `IsSpaceOwnerOrAdmin`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/spaces/ -v`
Expected: all PASS.

- [ ] **Step 5: Lint and commit**

```bash
uv run black . && uv run isort . && uv run flake8 .
git add apps/spaces/views.py tests/spaces/test_space_update.py
git commit -m "feat(backend): allow space owner/admin to PATCH name and currency"
```

---

### Task 3: Backend — category delete returns 409 when in use

**Files:**
- Modify: `backend/apps/budgets/views.py` (`CategoryDetailView`)
- Test: `backend/tests/budgets/test_categories.py` (append)

**Interfaces:**
- Consumes: existing `CategoryDetailView`, `Transaction.category` (`on_delete=PROTECT`).
- Produces: `DELETE /api/budgets/categories/{id}/` → `409 {"detail": "This category has transactions and cannot be deleted."}` when protected (by a Transaction **or** RecurringTransaction), `204` otherwise. Frontend Task 15 shows this detail message as a toast.

- [ ] **Step 1: Write the failing test**

Append to the existing test class in `backend/tests/budgets/test_categories.py` (match the file's existing fixture/setup style when you open it — the test below assumes `auth_client` and creating a space via the API, which auto-creates default categories):

```python
    def test_delete_category_with_transactions_returns_409(self, auth_client):
        """Deleting a category that has transactions returns 409 and keeps the category."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        category_id = auth_client.get(f"/api/budgets/categories/?space_id={space_id}").data[0]["id"]
        auth_client.post(
            "/api/budgets/transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "10.00",
                "date": "2026-07-01",
                "paid_by": auth_client._user.id,
            },
        )
        response = auth_client.delete(f"/api/budgets/categories/{category_id}/")
        assert response.status_code == 409
        assert response.data["detail"] == "This category has transactions and cannot be deleted."
        remaining = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        assert any(c["id"] == category_id for c in remaining.data)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/budgets/test_categories.py -v -k 409`
Expected: FAIL — currently raises `ProtectedError` (500).

- [ ] **Step 3: Implement the 409 handling**

In `backend/apps/budgets/views.py`, extend the imports:

```python
from django.db.models.deletion import ProtectedError
from rest_framework import generics, status
```

(keep the existing `NotFound, PermissionDenied, ValidationError` / `Response` / `APIView` imports as they are)

and add a `destroy` override to `CategoryDetailView`:

```python
class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(space__memberships__user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This category has transactions and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/budgets/ -v`
Expected: all PASS.

- [ ] **Step 5: Lint and commit**

```bash
uv run black . && uv run isort . && uv run flake8 .
git add apps/budgets/views.py tests/budgets/test_categories.py
git commit -m "feat(backend): return 409 when deleting a category that is in use"
```

---

### Task 4: Frontend — currency catalog + locale guess (`lib/currencies.ts`)

**Files:**
- Create: `frontend/src/lib/currencies.ts`
- Test: `frontend/src/lib/__tests__/currencies.test.ts`

**Interfaces:**
- Produces:
  - `interface Currency { code: string; symbol: string; name: string }`
  - `CURRENCIES: Currency[]` (~30 entries)
  - `defaultCurrencyForLocale(locale?: string): string` — returns a code from `CURRENCIES`, falls back to `'USD'`. Used by Task 8 (Create Space modal).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/__tests__/currencies.test.ts`:

```typescript
import { CURRENCIES, defaultCurrencyForLocale } from '@/lib/currencies'

describe('CURRENCIES', () => {
  it('contains unique 3-letter codes with symbol and name', () => {
    /** Every catalog entry has a unique uppercase 3-letter code plus a non-empty symbol and name. */
    const codes = CURRENCIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of CURRENCIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/)
      expect(c.symbol.length).toBeGreaterThan(0)
      expect(c.name.length).toBeGreaterThan(0)
    }
  })

  it('includes the majors', () => {
    /** USD, EUR and GBP are always available. */
    const codes = CURRENCIES.map((c) => c.code)
    expect(codes).toEqual(expect.arrayContaining(['USD', 'EUR', 'GBP']))
  })
})

describe('defaultCurrencyForLocale', () => {
  it('maps a German locale to EUR', () => {
    /** de-DE resolves to region DE which uses the euro. */
    expect(defaultCurrencyForLocale('de-DE')).toBe('EUR')
  })

  it('maps a US locale to USD', () => {
    /** en-US resolves to region US. */
    expect(defaultCurrencyForLocale('en-US')).toBe('USD')
  })

  it('maps a bare language to its likely region currency', () => {
    /** 'pl' maximizes to pl-PL, so PLN. */
    expect(defaultCurrencyForLocale('pl')).toBe('PLN')
  })

  it('falls back to USD for unknown input', () => {
    /** Unmappable locales fall back to USD rather than throwing. */
    expect(defaultCurrencyForLocale('zz-ZZ')).toBe('USD')
    expect(defaultCurrencyForLocale('not a locale !!!')).toBe('USD')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `pnpm test:run src/lib/__tests__/currencies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/currencies.ts`:

```typescript
export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'GEL', symbol: '₾', name: 'Georgian Lari' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
]

const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  JP: 'JPY',
  CN: 'CNY',
  CH: 'CHF',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  PL: 'PLN',
  CZ: 'CZK',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  HU: 'HUF',
  RO: 'RON',
  BY: 'BYN',
  UA: 'UAH',
  RU: 'RUB',
  TR: 'TRY',
  GE: 'GEL',
  KZ: 'KZT',
  IN: 'INR',
  KR: 'KRW',
  SG: 'SGD',
  HK: 'HKD',
  TH: 'THB',
  IL: 'ILS',
  AE: 'AED',
  BR: 'BRL',
  MX: 'MXN',
  ZA: 'ZAR',
  // Eurozone
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  LT: 'EUR',
  LV: 'EUR',
  EE: 'EUR',
  LU: 'EUR',
  HR: 'EUR',
  CY: 'EUR',
  MT: 'EUR',
}

export function defaultCurrencyForLocale(locale: string = navigator.language): string {
  try {
    const region = new Intl.Locale(locale).maximize().region
    return (region && REGION_TO_CURRENCY[region]) || 'USD'
  } catch {
    return 'USD'
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/lib/__tests__/currencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/lib/currencies.ts src/lib/__tests__/currencies.test.ts
git commit -m "feat(frontend): add currency catalog and browser-locale currency guess"
```

---

### Task 5: Frontend — money formatting (`lib/money.ts`)

**Files:**
- Create: `frontend/src/lib/money.ts`
- Test: `frontend/src/lib/__tests__/money.test.ts`

**Interfaces:**
- Produces: `formatMoney(amount: string | number, currency: string, locale?: string): string` — bare narrow symbol, 2 decimals per currency convention, thousands separators. Default locale is `navigator.language`. All pages (Tasks 13–17) use this.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/__tests__/money.test.ts`:

```typescript
import { formatMoney } from '@/lib/money'

// Intl uses non-breaking spaces (U+00A0 / U+202F) between number and symbol in
// some locales; normalize them so assertions are readable.
function norm(s: string): string {
  return s.replace(/[  ]/g, ' ')
}

describe('formatMoney', () => {
  it('formats USD with a bare dollar sign', () => {
    /** String amounts from the API format with $ and two decimals. */
    expect(formatMoney('84.2', 'USD', 'en-US')).toBe('$84.20')
  })

  it('adds thousands separators', () => {
    /** Large amounts get grouped digits. */
    expect(formatMoney(2400, 'USD', 'en-US')).toBe('$2,400.00')
  })

  it('uses the narrow symbol, not a prefixed one', () => {
    /** CAD in en-US must be $ (narrowSymbol), never CA$. */
    expect(formatMoney(5, 'CAD', 'en-US')).toBe('$5.00')
  })

  it('follows the locale convention for symbol placement', () => {
    /** de-DE puts the € after the number with comma decimals. */
    expect(norm(formatMoney(1234.56, 'EUR', 'de-DE'))).toBe('1.234,56 €')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/lib/__tests__/money.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/money.ts`:

```typescript
export function formatMoney(amount: string | number, currency: string, locale: string = navigator.language): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(value)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/lib/__tests__/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/lib/money.ts src/lib/__tests__/money.test.ts
git commit -m "feat(frontend): add formatMoney with narrow currency symbols"
```

---

### Task 6: Frontend — date helpers (`lib/dates.ts`)

**Files:**
- Create: `frontend/src/lib/dates.ts`
- Test: `frontend/src/lib/__tests__/dates.test.ts`

**Interfaces:**
- Produces (all operate on plain strings, no Date objects leak out):
  - `currentMonth(): string` → `'2026-07'`
  - `stepMonth(month: string, delta: number): string`
  - `formatMonth(month: string): string` → `'July 2026'`
  - `formatDayHeading(date: string): string` → `'Thu, May 14'`
  - `currentWeekStart(): string` → ISO date of this week's Monday
  - `stepWeek(weekStart: string, delta: number): string`
  - `formatWeekRange(weekStart: string): string` → `'12–18 May 2026'` or `'28 Apr – 4 May 2026'`
  - Used by Tasks 14 (transactions) and 17 (reports).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/__tests__/dates.test.ts`:

```typescript
import {
  currentMonth,
  stepMonth,
  formatMonth,
  formatDayHeading,
  currentWeekStart,
  stepWeek,
  formatWeekRange,
} from '@/lib/dates'

describe('month helpers', () => {
  it('returns the current month as YYYY-MM', () => {
    /** currentMonth matches the wall clock. */
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
  })

  it('steps months forward and backward across year boundaries', () => {
    /** stepMonth handles December→January and January→December. */
    expect(stepMonth('2026-12', 1)).toBe('2027-01')
    expect(stepMonth('2026-01', -1)).toBe('2025-12')
    expect(stepMonth('2026-05', 1)).toBe('2026-06')
  })

  it('formats a month for display', () => {
    /** '2026-05' renders as a month name plus year. */
    expect(formatMonth('2026-05')).toBe('May 2026')
  })
})

describe('day heading', () => {
  it('formats an ISO date as weekday + month + day', () => {
    /** 2026-05-14 is a Thursday. */
    expect(formatDayHeading('2026-05-14')).toBe('Thu, May 14')
  })
})

describe('week helpers', () => {
  it('returns a Monday for the current week start', () => {
    /** Weeks are ISO — currentWeekStart is always a Monday. */
    const [y, m, d] = currentWeekStart().split('-').map(Number)
    expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1)
  })

  it('steps whole weeks', () => {
    /** stepWeek moves exactly 7 days, crossing month boundaries. */
    expect(stepWeek('2026-05-11', 1)).toBe('2026-05-18')
    expect(stepWeek('2026-05-04', -1)).toBe('2026-04-27')
  })

  it('formats a same-month week range compactly', () => {
    /** Both ends in May collapse the month name. */
    expect(formatWeekRange('2026-05-11')).toBe('11–17 May 2026')
  })

  it('formats a cross-month week range with both months', () => {
    /** 27 Apr–3 May spans two months. */
    expect(formatWeekRange('2026-04-27')).toBe('27 Apr – 3 May 2026')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/lib/__tests__/dates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/dates.ts`:

```typescript
const DAY_MS = 24 * 60 * 60 * 1000

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function stepMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const year = Math.floor(total / 12)
  const mon = (total % 12) + 1
  return `${year}-${String(mon).padStart(2, '0')}`
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDayHeading(date: string): string {
  return toUTC(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function currentWeekStart(): string {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = today.getUTCDay() // 0 = Sunday
  const sinceMonday = (day + 6) % 7
  return toISODate(new Date(today.getTime() - sinceMonday * DAY_MS))
}

export function stepWeek(weekStart: string, delta: number): string {
  return toISODate(new Date(toUTC(weekStart).getTime() + delta * 7 * DAY_MS))
}

export function formatWeekRange(weekStart: string): string {
  const start = toUTC(weekStart)
  const end = new Date(start.getTime() + 6 * DAY_MS)
  const opts = { timeZone: 'UTC' } as const
  const year = end.toLocaleDateString('en-US', { year: 'numeric', ...opts })
  if (start.getUTCMonth() === end.getUTCMonth()) {
    const month = end.toLocaleDateString('en-US', { month: 'short', ...opts })
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month} ${year}`
  }
  const startPart = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...opts })
  const endPart = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...opts })
  return `${startPart.split(' ').reverse().join(' ')} – ${endPart.split(' ').reverse().join(' ')} ${year}`
}
```

Note: `toLocaleDateString('en-US', { day: 'numeric', month: 'short' })` yields `"Apr 27"`; the `split/reverse/join` turns it into `"27 Apr"`. If the test expectations fail on exact strings, adjust the implementation — not the expected values.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/lib/__tests__/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/lib/dates.ts src/lib/__tests__/dates.test.ts
git commit -m "feat(frontend): add month/week/day date helpers"
```

---

### Task 7: Frontend — UI primitives (shadcn Switch + Tabs, NativeSelect)

**Files:**
- Create: `frontend/src/components/ui/switch.tsx` (shadcn CLI)
- Create: `frontend/src/components/ui/tabs.tsx` (shadcn CLI)
- Create: `frontend/src/components/ui/native-select.tsx`
- Test: `frontend/src/components/ui/__tests__/native-select.test.tsx`

**Interfaces:**
- Produces: `Switch` and `Tabs`/`TabsList`/`TabsTrigger` (standard shadcn API, Radix-based), and `NativeSelect` — a styled native `<select>` accepting all `React.ComponentProps<'select'>`. Tasks 8, 10, 13, 15, 16, 17 use these.

- [ ] **Step 1: Add shadcn components**

```bash
pnpm dlx shadcn@latest add switch tabs
```

Expected: creates `src/components/ui/switch.tsx` and `src/components/ui/tabs.tsx`. Verify they import from `'radix-ui'` (unified package) like the existing `dialog.tsx`; if the CLI emitted `@radix-ui/react-switch` style imports, rewrite them to match `dialog.tsx`'s `import { Switch as SwitchPrimitive } from 'radix-ui'` pattern and remove any newly added `@radix-ui/*` deps in favor of the existing `radix-ui` package.

- [ ] **Step 2: Write the failing NativeSelect test**

Create `frontend/src/components/ui/__tests__/native-select.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NativeSelect } from '@/components/ui/native-select'

describe('NativeSelect', () => {
  it('renders options and reports selection changes', async () => {
    /** NativeSelect is a plain select: selectOptions works and onChange fires with the value. */
    const onChange = vi.fn()
    render(
      <NativeSelect aria-label="pick" onChange={(e) => onChange(e.target.value)} defaultValue="a">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>
    )
    await userEvent.selectOptions(screen.getByLabelText('pick'), 'b')
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:run src/components/ui/__tests__/native-select.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement NativeSelect**

Create `frontend/src/components/ui/native-select.tsx`:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run src/components/ui`
Expected: PASS (including any pre-existing ui tests).

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/components/ui package.json pnpm-lock.yaml
git commit -m "feat(frontend): add Switch, Tabs and NativeSelect ui primitives"
```

---

### Task 8: Frontend — Space currency type + MSW handlers for budget endpoints

**Files:**
- Modify: `frontend/src/hooks/useSpaces.ts` (Space interface, useCreateSpace)
- Modify: `frontend/src/mocks/handlers.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `Space` interface gains `currency: string`; `useCreateSpace` mutationFn takes `{ name: string; currency: string }`.
  - MSW fixtures exported from `handlers.ts`: `mockCategories` (Groceries id 1 🛒 expense, Dining Out id 2 🍽️ expense, Salary id 3 💰 income), `mockTransactions` (two expenses + one income dated in `2026-05`).
  - Default handlers for: `GET/POST /api/budgets/categories/`, `PATCH/DELETE /api/budgets/categories/:id/`, `GET/POST /api/budgets/transactions/`, `PATCH/DELETE /api/budgets/transactions/:id/`, `GET/POST /api/budgets/recurring-transactions/`, `PATCH/DELETE /api/budgets/recurring-transactions/:id/`, `GET /api/budgets/reports/:reportType/`, `PATCH /api/spaces/:id/`.
  - All later frontend tests use these defaults and override per-test with `server.use(...)`.

- [ ] **Step 1: Update the Space type and useCreateSpace**

In `frontend/src/hooks/useSpaces.ts`:

```typescript
export interface Space {
  id: number
  name: string
  currency: string
  created_at: string
  members: SpaceMember[]
}
```

and in `useCreateSpace`, change the mutationFn signature:

```typescript
    mutationFn: (data: { name: string; currency: string }) => api.post<Space>('/api/spaces/', data).then((r) => r.data),
```

Run `pnpm test:run` — expect **compile errors** in `CreateSpaceModal.tsx` (missing `currency` argument). Temporarily patch the call site in `CreateSpaceModal.tsx` to `createSpace.mutate({ name: name.trim(), currency: 'USD' }, …)` — Task 9 replaces this with the real picker.

- [ ] **Step 2: Add currency to space fixtures and the new handlers**

In `frontend/src/mocks/handlers.ts`:

1. Add `currency: 'USD'` to the space object in the `GET /api/spaces/` fixture and to the response of `POST /api/spaces/` (echo `body.currency ?? 'USD'`; type the parsed body as `{ name: string; currency?: string }`).

2. Add exported fixtures and handlers (append inside the file; keep `BASE` as is):

```typescript
export const mockCategories = [
  { id: 1, name: 'Groceries', icon: '🛒', is_income: false },
  { id: 2, name: 'Dining Out', icon: '🍽️', is_income: false },
  { id: 3, name: 'Salary', icon: '💰', is_income: true },
]

export const mockTransactions = [
  {
    id: 1,
    space: 1,
    category: 1,
    amount: '84.20',
    date: '2026-05-14',
    paid_by: 1,
    notes: '',
    created_by: 1,
    created_at: '2026-05-14T10:00:00Z',
  },
  {
    id: 2,
    space: 1,
    category: 2,
    amount: '32.50',
    date: '2026-05-14',
    paid_by: 2,
    notes: 'Pizza night',
    created_by: 2,
    created_at: '2026-05-14T19:00:00Z',
  },
  {
    id: 3,
    space: 1,
    category: 3,
    amount: '2400.00',
    date: '2026-05-12',
    paid_by: 1,
    notes: '',
    created_by: 1,
    created_at: '2026-05-12T09:00:00Z',
  },
]

export const mockRecurring = [
  {
    id: 1,
    space: 1,
    category: 1,
    amount: '950.00',
    description: 'Rent',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_due_date: '2026-08-01',
    is_active: true,
  },
]

export const mockReport = [
  { category_id: 1, category_name: 'Groceries', category_icon: '🛒', total: '84.20' },
  { category_id: 2, category_name: 'Dining Out', category_icon: '🍽️', total: '32.50' },
  { category_id: 3, category_name: 'Salary', category_icon: '💰', total: '2400.00' },
]
```

and in the `handlers` array:

```typescript
  http.patch(`${BASE}/api/spaces/:id/`, async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; currency?: string }
    return HttpResponse.json({
      id: Number(params.id),
      name: body.name ?? 'Home Budget',
      currency: body.currency ?? 'USD',
      created_at: '2026-01-01T00:00:00Z',
      members: [],
    })
  }),

  http.get(`${BASE}/api/budgets/categories/`, () => HttpResponse.json(mockCategories)),
  http.post(`${BASE}/api/budgets/categories/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 99, ...body }, { status: 201 })
  }),
  http.patch(`${BASE}/api/budgets/categories/:id/`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: Number(params.id), ...body })
  }),
  http.delete(`${BASE}/api/budgets/categories/:id/`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/api/budgets/transactions/`, () => HttpResponse.json(mockTransactions)),
  http.post(`${BASE}/api/budgets/transactions/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 99, created_by: 1, created_at: '2026-05-15T00:00:00Z', ...body }, { status: 201 })
  }),
  http.patch(`${BASE}/api/budgets/transactions/:id/`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: Number(params.id), ...body })
  }),
  http.delete(`${BASE}/api/budgets/transactions/:id/`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/api/budgets/recurring-transactions/`, () => HttpResponse.json(mockRecurring)),
  http.post(`${BASE}/api/budgets/recurring-transactions/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 99, ...body }, { status: 201 })
  }),
  http.patch(`${BASE}/api/budgets/recurring-transactions/:id/`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: Number(params.id), ...body })
  }),
  http.delete(`${BASE}/api/budgets/recurring-transactions/:id/`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/api/budgets/reports/:reportType/`, () => HttpResponse.json(mockReport)),
```

- [ ] **Step 3: Run the full suite to verify nothing broke**

Run: `pnpm test:run`
Expected: all existing tests PASS.

- [ ] **Step 4: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/hooks/useSpaces.ts src/mocks/handlers.ts src/features/spaces/CreateSpaceModal.tsx
git commit -m "feat(frontend): add currency to Space type and MSW handlers for budget endpoints"
```

---

### Task 9: Frontend — currency picker in Create Space modal

**Files:**
- Modify: `frontend/src/features/spaces/CreateSpaceModal.tsx`
- Test: `frontend/src/features/spaces/__tests__/CreateSpaceModal.test.tsx` (create if missing; if creation tests live in `SpacesPage.test.tsx`, add there instead)

**Interfaces:**
- Consumes: `CURRENCIES`, `defaultCurrencyForLocale` (Task 4), `NativeSelect` (Task 7), `useCreateSpace` with `{ name, currency }` (Task 8).
- Produces: Create Space dialog with a currency select pre-filled from browser locale; POST body includes the chosen code.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/spaces/__tests__/CreateSpaceModal.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { CreateSpaceModal } from '../CreateSpaceModal'
import * as currencies from '@/lib/currencies'

const BASE = 'http://localhost:8000'

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CreateSpaceModal open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CreateSpaceModal currency', () => {
  it('pre-selects the currency guessed from the browser locale', async () => {
    /** The currency select defaults to the locale-derived code. */
    vi.spyOn(currencies, 'defaultCurrencyForLocale').mockReturnValue('EUR')
    renderModal()
    expect(screen.getByLabelText(/currency/i)).toHaveValue('EUR')
  })

  it('sends the chosen currency when creating a space', async () => {
    /** Changing the select changes the POST /api/spaces/ payload. */
    let posted: { name?: string; currency?: string } = {}
    server.use(
      http.post(`${BASE}/api/spaces/`, async ({ request }) => {
        posted = (await request.json()) as typeof posted
        return HttpResponse.json(
          { id: 5, name: posted.name, currency: posted.currency, created_at: '2026-01-01T00:00:00Z', members: [] },
          { status: 201 }
        )
      })
    )
    renderModal()
    await userEvent.type(screen.getByLabelText(/space name/i), 'Euro Home')
    await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'PLN')
    await userEvent.click(screen.getByRole('button', { name: /create space/i }))
    await waitFor(() => expect(posted).toEqual({ name: 'Euro Home', currency: 'PLN' }))
  })

  it('shows symbol-first labels without ISO codes', () => {
    /** Options read like "€ Euro" — the ISO code is not user-visible text. */
    renderModal()
    expect(screen.getByRole('option', { name: '€ Euro' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /EUR/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/features/spaces/__tests__/CreateSpaceModal.test.tsx`
Expected: FAIL — no currency select rendered.

- [ ] **Step 3: Implement the picker**

Rewrite `frontend/src/features/spaces/CreateSpaceModal.tsx` (replaces the temporary `currency: 'USD'` patch from Task 8):

```tsx
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { toast } from 'sonner'
import { useCreateSpace } from '@/hooks/useSpaces'
import { CURRENCIES, defaultCurrencyForLocale } from '@/lib/currencies'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateSpaceModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(() => defaultCurrencyForLocale())
  const createSpace = useCreateSpace()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createSpace.mutate(
      { name: name.trim(), currency },
      {
        onSuccess: () => {
          setName('')
          onClose()
        },
        onError: () => toast.error('Failed to create space. Please try again.'),
      }
    )
  }

  const handleClose = () => {
    setName('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new space</DialogTitle>
          <DialogDescription>Spaces let you share a budget with your household or a group.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="space-name">Space name</Label>
            <Input
              id="space-name"
              placeholder="e.g. Home Budget"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-currency">Currency</Label>
            <NativeSelect id="space-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Guessed from your browser language — change it if it&apos;s wrong.
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || createSpace.isPending} onClick={handleSubmit}>
            {createSpace.isPending ? 'Creating…' : 'Create Space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/features/spaces`
Expected: PASS (new tests + existing SpacesPage/AcceptInvite tests).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/spaces
git commit -m "feat(frontend): currency picker with locale-based default in Create Space modal"
```

---

### Task 10: Frontend — Space settings card (change currency)

**Files:**
- Modify: `frontend/src/hooks/useSpaces.ts` (add `useUpdateSpace`)
- Modify: `frontend/src/features/spaces/SpacesPage.tsx` (add `SpaceSettingsCard`)
- Test: `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx` (append)

**Interfaces:**
- Consumes: `PATCH /api/spaces/{id}/` handler (Task 8), `NativeSelect`, `CURRENCIES`.
- Produces: `useUpdateSpace(): UseMutationResult` with `mutationFn({ id, name?, currency? })`, invalidating `['spaces']`. `SpaceSettingsCard` rendered between InviteCard and DangerZoneCard for owner **or admin** only.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx` (reuse the file's `renderSpaces` helper and `BASE`; the default `GET /api/spaces/` fixture has the current user as `owner`):

```tsx
  it('shows the space settings card to the owner', async () => {
    /** Owners see the Space Settings card with a currency select. */
    renderSpaces()
    await screen.findByText('Home Budget')
    expect(screen.getByText(/space settings/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
  })

  it('hides the space settings card from plain members', async () => {
    /** Members must not see the settings card. */
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
            currency: 'USD',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 1,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'member',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      )
    )
    renderSpaces()
    await screen.findByText('Home Budget')
    expect(screen.queryByText(/space settings/i)).not.toBeInTheDocument()
  })

  it('saves a currency change via PATCH', async () => {
    /** Picking a currency and clicking Save PATCHes the space. */
    let patched: { currency?: string } = {}
    server.use(
      http.patch(`${BASE}/api/spaces/:id/`, async ({ request }) => {
        patched = (await request.json()) as typeof patched
        return HttpResponse.json({
          id: 1,
          name: 'Home Budget',
          currency: patched.currency,
          created_at: '2026-01-01T00:00:00Z',
          members: [],
        })
      })
    )
    renderSpaces()
    await screen.findByText('Home Budget')
    await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'EUR')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(patched).toEqual({ currency: 'EUR' }))
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/features/spaces/__tests__/SpacesPage.test.tsx`
Expected: FAIL — no settings card.

- [ ] **Step 3: Implement**

1. Add to `frontend/src/hooks/useSpaces.ts`:

```typescript
export function useUpdateSpace() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; currency?: string }) =>
      api.patch<Space>(`/api/spaces/${id}/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] })
    },
  })
}
```

2. In `frontend/src/features/spaces/SpacesPage.tsx`, add the card component (top level of the file, near the other cards):

```tsx
function SpaceSettingsCard({ space }: { space: Space }) {
  const [currency, setCurrency] = useState(space.currency)
  const updateSpace = useUpdateSpace()

  const handleSave = () => {
    updateSpace.mutate(
      { id: space.id, currency },
      {
        onSuccess: () => toast.success('Space settings saved'),
        onError: () => toast.error('Failed to save space settings. Please try again.'),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Space Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="settings-currency">Currency</Label>
            <NativeSelect id="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button onClick={handleSave} disabled={currency === space.currency || updateSpace.isPending}>
            {updateSpace.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Changes how amounts are displayed for everyone in this space. Existing amounts are not converted.
        </p>
      </CardContent>
    </Card>
  )
}
```

New imports needed in `SpacesPage.tsx`: `toast` from `'sonner'`, `NativeSelect`, `CURRENCIES` from `'@/lib/currencies'`, `useUpdateSpace` added to the existing `useSpaces` import.

3. In the `SpacesPage` component: compute `const isOwnerOrAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin'` next to the existing `isOwner`, and render between `InviteCard` and the DangerZone:

```tsx
          {isOwnerOrAdmin && <SpaceSettingsCard key={`settings-${selectedSpace.id}`} space={selectedSpace} />}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/features/spaces`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/hooks/useSpaces.ts src/features/spaces
git commit -m "feat(frontend): space settings card with currency editing for owner/admin"
```

---

### Task 11: Frontend — budget data hooks (`hooks/useBudget.ts`)

**Files:**
- Create: `frontend/src/hooks/useBudget.ts`
- Test: `frontend/src/hooks/__tests__/useBudget.test.tsx`

**Interfaces:**
- Consumes: `api` axios instance, MSW handlers (Task 8).
- Produces (all pages consume these — exact names matter):

```typescript
export interface Category { id: number; name: string; icon: string; is_income: boolean }
export interface Transaction {
  id: number; space: number; category: number; amount: string; date: string
  paid_by: number; notes: string; created_by: number; created_at: string
}
export interface RecurringTransaction {
  id: number; space: number; category: number; amount: string; description: string
  frequency: 'weekly' | 'monthly' | 'yearly'; start_date: string; next_due_date: string; is_active: boolean
}
export interface ReportRow { category_id: number; category_name: string; category_icon: string; total: string }
export type ReportPeriodType = 'week' | 'month' | 'year'

useCategories(spaceId: number | null)
useCreateCategory(spaceId)   // mutate({ name, icon, is_income })
useUpdateCategory(spaceId)   // mutate({ id, name, icon, is_income })
useDeleteCategory(spaceId)   // mutate(id)
useTransactions(spaceId, filters: { month: string; categoryId?: number })
useCreateTransaction(spaceId) // mutate({ category, amount, date, paid_by, notes })
useUpdateTransaction(spaceId) // mutate({ id, category, amount, date, paid_by, notes })
useDeleteTransaction(spaceId) // mutate(id)
useRecurring(spaceId)
useCreateRecurring(spaceId)   // mutate({ category, amount, description, frequency, start_date, next_due_date })
useUpdateRecurring(spaceId)   // mutate({ id, ...partial fields })
useDeleteRecurring(spaceId)   // mutate(id)
useReport(spaceId, periodType: ReportPeriodType, periodValue: string)
```

Queries are `enabled` only when `spaceId !== null`. Category mutations invalidate `['categories', spaceId]`, `['transactions', spaceId]`, `['report', spaceId]`. Transaction mutations invalidate `['transactions', spaceId]` and `['report', spaceId]`. Recurring mutations invalidate `['recurring', spaceId]`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/__tests__/useBudget.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useCategories, useTransactions, useCreateTransaction, useReport } from '@/hooks/useBudget'

const BASE = 'http://localhost:8000'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useBudget hooks', () => {
  it('fetches categories for a space', async () => {
    /** useCategories loads the category list from the API. */
    const { result } = renderHook(() => useCategories(1), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(3)
    expect(result.current.data![0].name).toBe('Groceries')
  })

  it('does not fetch when spaceId is null', () => {
    /** Queries stay idle without a selected space. */
    const { result } = renderHook(() => useCategories(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('passes month and category filters as query params', async () => {
    /** useTransactions forwards space_id, month and category_id to the API. */
    let url = ''
    server.use(
      http.get(`${BASE}/api/budgets/transactions/`, ({ request }) => {
        url = request.url
        return HttpResponse.json([])
      })
    )
    const { result } = renderHook(() => useTransactions(1, { month: '2026-05', categoryId: 2 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(url).toContain('space_id=1')
    expect(url).toContain('month=2026-05')
    expect(url).toContain('category_id=2')
  })

  it('creates a transaction with space_id in the body', async () => {
    /** useCreateTransaction POSTs the payload plus space_id. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/transactions/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 9, ...posted }, { status: 201 })
      })
    )
    const { result } = renderHook(() => useCreateTransaction(1), { wrapper })
    result.current.mutate({ category: 1, amount: '10.00', date: '2026-05-15', paid_by: 1, notes: '' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(posted.space_id).toBe(1)
    expect(posted.amount).toBe('10.00')
  })

  it('fetches a report for the given period', async () => {
    /** useReport hits the endpoint matching the period type with the right param. */
    let url = ''
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, ({ request }) => {
        url = request.url
        return HttpResponse.json([])
      })
    )
    const { result } = renderHook(() => useReport(1, 'month', '2026-05'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(url).toContain('/api/budgets/reports/monthly-summary/')
    expect(url).toContain('month=2026-05')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/hooks/__tests__/useBudget.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/hooks/useBudget.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Category {
  id: number
  name: string
  icon: string
  is_income: boolean
}

export interface Transaction {
  id: number
  space: number
  category: number
  amount: string
  date: string
  paid_by: number
  notes: string
  created_by: number
  created_at: string
}

export interface RecurringTransaction {
  id: number
  space: number
  category: number
  amount: string
  description: string
  frequency: 'weekly' | 'monthly' | 'yearly'
  start_date: string
  next_due_date: string
  is_active: boolean
}

export interface ReportRow {
  category_id: number
  category_name: string
  category_icon: string
  total: string
}

export type ReportPeriodType = 'week' | 'month' | 'year'

const REPORT_ENDPOINTS: Record<ReportPeriodType, { path: string; param: string }> = {
  week: { path: 'weekly-summary', param: 'week' },
  month: { path: 'monthly-summary', param: 'month' },
  year: { path: 'yearly-summary', param: 'year' },
}

// --- Categories ---

export function useCategories(spaceId: number | null) {
  return useQuery({
    queryKey: ['categories', spaceId],
    enabled: spaceId !== null,
    queryFn: () => api.get<Category[]>(`/api/budgets/categories/?space_id=${spaceId}`).then((r) => r.data),
  })
}

function useInvalidateBudget(spaceId: number, keys: string[]) {
  const qc = useQueryClient()
  return () => {
    for (const key of keys) qc.invalidateQueries({ queryKey: [key, spaceId] })
  }
}

export function useCreateCategory(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['categories', 'transactions', 'report'])
  return useMutation({
    mutationFn: (data: { name: string; icon: string; is_income: boolean }) =>
      api.post<Category>('/api/budgets/categories/', { ...data, space_id: spaceId }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['categories', 'transactions', 'report'])
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; icon: string; is_income: boolean }) =>
      api.patch<Category>(`/api/budgets/categories/${id}/`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['categories', 'transactions', 'report'])
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/budgets/categories/${id}/`),
    onSuccess: invalidate,
  })
}

// --- Transactions ---

export function useTransactions(spaceId: number | null, filters: { month: string; categoryId?: number }) {
  return useQuery({
    queryKey: ['transactions', spaceId, filters.month, filters.categoryId ?? null],
    enabled: spaceId !== null,
    queryFn: () => {
      const params = new URLSearchParams({ space_id: String(spaceId), month: filters.month })
      if (filters.categoryId) params.set('category_id', String(filters.categoryId))
      return api.get<Transaction[]>(`/api/budgets/transactions/?${params}`).then((r) => r.data)
    },
  })
}

export interface TransactionPayload {
  category: number
  amount: string
  date: string
  paid_by: number
  notes: string
}

export function useCreateTransaction(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['transactions', 'report'])
  return useMutation({
    mutationFn: (data: TransactionPayload) =>
      api.post<Transaction>('/api/budgets/transactions/', { ...data, space_id: spaceId }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['transactions', 'report'])
  return useMutation({
    mutationFn: ({ id, ...data }: TransactionPayload & { id: number }) =>
      api.patch<Transaction>(`/api/budgets/transactions/${id}/`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['transactions', 'report'])
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/budgets/transactions/${id}/`),
    onSuccess: invalidate,
  })
}

// --- Recurring ---

export function useRecurring(spaceId: number | null) {
  return useQuery({
    queryKey: ['recurring', spaceId],
    enabled: spaceId !== null,
    queryFn: () =>
      api.get<RecurringTransaction[]>(`/api/budgets/recurring-transactions/?space_id=${spaceId}`).then((r) => r.data),
  })
}

export interface RecurringPayload {
  category: number
  amount: string
  description: string
  frequency: 'weekly' | 'monthly' | 'yearly'
  start_date: string
  next_due_date: string
}

export function useCreateRecurring(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['recurring'])
  return useMutation({
    mutationFn: (data: RecurringPayload) =>
      api.post<RecurringTransaction>('/api/budgets/recurring-transactions/', { ...data, space_id: spaceId }).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateRecurring(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['recurring'])
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<RecurringPayload & { is_active: boolean }>) =>
      api.patch<RecurringTransaction>(`/api/budgets/recurring-transactions/${id}/`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useDeleteRecurring(spaceId: number) {
  const invalidate = useInvalidateBudget(spaceId, ['recurring'])
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/budgets/recurring-transactions/${id}/`),
    onSuccess: invalidate,
  })
}

// --- Reports ---

export function useReport(spaceId: number | null, periodType: ReportPeriodType, periodValue: string) {
  const { path, param } = REPORT_ENDPOINTS[periodType]
  return useQuery({
    queryKey: ['report', spaceId, periodType, periodValue],
    enabled: spaceId !== null,
    queryFn: () =>
      api.get<ReportRow[]>(`/api/budgets/reports/${path}/?space_id=${spaceId}&${param}=${periodValue}`).then((r) => r.data),
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/hooks`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/hooks/useBudget.ts src/hooks/__tests__/useBudget.test.tsx
git commit -m "feat(frontend): TanStack Query hooks for budget API"
```

---

### Task 12: Frontend — budget scaffolding (`useSelectedSpace`, `NoSpaceState`)

**Files:**
- Create: `frontend/src/features/budget/useSelectedSpace.ts`
- Create: `frontend/src/features/budget/NoSpaceState.tsx`
- Test: `frontend/src/features/budget/__tests__/NoSpaceState.test.tsx`

**Interfaces:**
- Consumes: `useSpaces` (`Space` now has `currency`), `useSpaceStore`.
- Produces:
  - `useSelectedSpace(): { space: Space | null; isLoading: boolean }` — the store's selected space, falling back to the first available space, `null` when the user has none. Read-only (never writes the store).
  - `NoSpaceState` — card with copy "Create a space to start tracking your budget." and a link to `/spaces`.
  - Every page (Tasks 13–17) starts with: `if (isLoading) return <skeletons>; if (!space) return <NoSpaceState />`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/budget/__tests__/NoSpaceState.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NoSpaceState } from '../NoSpaceState'

describe('NoSpaceState', () => {
  it('explains the requirement and links to the spaces page', () => {
    /** The empty state points the user at /spaces to create a space. */
    render(
      <MemoryRouter>
        <NoSpaceState />
      </MemoryRouter>
    )
    expect(screen.getByText(/create a space to start tracking your budget/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to spaces/i })).toHaveAttribute('href', '/spaces')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/budget`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/features/budget/useSelectedSpace.ts`:

```typescript
import { useSpaces, type Space } from '@/hooks/useSpaces'
import { useSpaceStore } from '@/store/spaceStore'

export function useSelectedSpace(): { space: Space | null; isLoading: boolean } {
  const { data: spaces = [], isLoading } = useSpaces()
  const selectedSpaceId = useSpaceStore((s) => s.selectedSpaceId)
  const space = spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null
  return { space, isLoading }
}
```

Create `frontend/src/features/budget/NoSpaceState.tsx`:

```tsx
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NoSpaceState() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Create a space to start tracking your budget.</p>
          <Button asChild className="mt-4">
            <Link to="/spaces">Go to Spaces</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/features/budget`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget
git commit -m "feat(frontend): budget scaffolding - selected space hook and no-space state"
```

---

### Task 13: Frontend — TransactionDialog (add/edit/delete)

**Files:**
- Create: `frontend/src/features/budget/lastCategory.ts`
- Create: `frontend/src/features/budget/TransactionDialog.tsx`
- Test: `frontend/src/features/budget/__tests__/TransactionDialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction`, `Category`, `Transaction` (Task 11); `NativeSelect`; `Space` (for members + id).
- Produces:
  - `getLastCategoryId(spaceId: number): number | null` / `setLastCategoryId(spaceId: number, categoryId: number): void` (localStorage key `lastCategory:{spaceId}`).
  - `TransactionDialog` props: `{ open: boolean; transaction: Transaction | null; space: Space; categories: Category[]; onClose: () => void }`. `transaction === null` → add mode; otherwise edit mode with Delete button. Task 14 renders it.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/budget/__tests__/TransactionDialog.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { mockCategories } from '@/mocks/handlers'
import { TransactionDialog } from '../TransactionDialog'
import { setLastCategoryId } from '../lastCategory'
import { useAuthStore } from '@/store/authStore'
import type { Space } from '@/hooks/useSpaces'
import type { Transaction } from '@/hooks/useBudget'

const BASE = 'http://localhost:8000'

const space: Space = {
  id: 1,
  name: 'Home Budget',
  currency: 'USD',
  created_at: '2026-01-01T00:00:00Z',
  members: [
    {
      id: 1,
      user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
      role: 'owner',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      user: { id: 2, email: 'other@example.com', display_name: 'Other User' },
      role: 'member',
      joined_at: '2026-01-02T00:00:00Z',
    },
  ],
}

const existing: Transaction = {
  id: 7,
  space: 1,
  category: 2,
  amount: '32.50',
  date: '2026-05-14',
  paid_by: 2,
  notes: 'Pizza night',
  created_by: 2,
  created_at: '2026-05-14T19:00:00Z',
}

function renderDialog(transaction: Transaction | null = null, onClose = () => {}) {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TransactionDialog open transaction={transaction} space={space} categories={mockCategories} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TransactionDialog', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    localStorage.clear()
  })

  it('defaults date to today and payer to the current user', () => {
    /** Add mode pre-fills date=today and paid_by=current user. */
    renderDialog()
    const today = new Date().toISOString().slice(0, 10)
    expect(screen.getByLabelText(/date/i)).toHaveValue(today)
    expect(screen.getByLabelText(/paid by/i)).toHaveValue('1')
  })

  it('defaults category to the last used one for this space', () => {
    /** The category select restores the persisted last-used category. */
    setLastCategoryId(1, 2)
    renderDialog()
    expect(screen.getByLabelText(/category/i)).toHaveValue('2')
  })

  it('rejects an invalid amount', async () => {
    /** Submitting a non-numeric amount shows a validation error and does not POST. */
    renderDialog()
    await userEvent.type(screen.getByLabelText(/amount/i), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/enter a positive amount/i)).toBeInTheDocument()
  })

  it('creates a transaction and remembers the category', async () => {
    /** A valid submit POSTs the payload and persists the chosen category as last-used. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/transactions/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 9, ...posted }, { status: 201 })
      })
    )
    const onClose = vi.fn()
    renderDialog(null, onClose)
    await userEvent.type(screen.getByLabelText(/amount/i), '12.30')
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '2')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posted.amount).toBe('12.30')
    expect(posted.category).toBe(2)
    expect(posted.space_id).toBe(1)
    expect(localStorage.getItem('lastCategory:1')).toBe('2')
  })

  it('pre-fills fields and PATCHes in edit mode', async () => {
    /** Edit mode shows the transaction values and saves via PATCH. */
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${BASE}/api/budgets/transactions/:id/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 7, ...patched })
      })
    )
    const onClose = vi.fn()
    renderDialog(existing, onClose)
    expect(screen.getByLabelText(/amount/i)).toHaveValue('32.50')
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Pizza night')
    await userEvent.clear(screen.getByLabelText(/amount/i))
    await userEvent.type(screen.getByLabelText(/amount/i), '40.00')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(patched.amount).toBe('40.00')
  })

  it('deletes after inline confirmation in edit mode', async () => {
    /** Delete requires a second confirming click, then DELETEs and closes. */
    let deleted = false
    server.use(
      http.delete(`${BASE}/api/budgets/transactions/:id/`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    const onClose = vi.fn()
    renderDialog(existing, onClose)
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleted).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/features/budget/__tests__/TransactionDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/features/budget/lastCategory.ts`:

```typescript
export function getLastCategoryId(spaceId: number): number | null {
  const raw = localStorage.getItem(`lastCategory:${spaceId}`)
  const id = raw === null ? NaN : Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function setLastCategoryId(spaceId: number, categoryId: number): void {
  localStorage.setItem(`lastCategory:${spaceId}`, String(categoryId))
}
```

Create `frontend/src/features/budget/TransactionDialog.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useAuthStore } from '@/store/authStore'
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useBudget'
import type { Category, Transaction } from '@/hooks/useBudget'
import type { Space } from '@/hooks/useSpaces'
import { getLastCategoryId, setLastCategoryId } from './lastCategory'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a positive amount'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  paid_by: z.string().min(1),
  notes: z.string(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  transaction: Transaction | null
  space: Space
  categories: Category[]
  onClose: () => void
}

export function TransactionDialog({ open, transaction, space, categories, onClose }: Props) {
  const currentUser = useAuthStore((s) => s.user)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const createTransaction = useCreateTransaction(space.id)
  const updateTransaction = useUpdateTransaction(space.id)
  const deleteTransaction = useDeleteTransaction(space.id)

  const defaultCategory = transaction?.category ?? getLastCategoryId(space.id) ?? categories[0]?.id

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      amount: transaction?.amount ?? '',
      category: defaultCategory ? String(defaultCategory) : '',
      date: transaction?.date ?? new Date().toISOString().slice(0, 10),
      paid_by: String(transaction?.paid_by ?? currentUser?.id ?? ''),
      notes: transaction?.notes ?? '',
    },
  })

  const isPending = createTransaction.isPending || updateTransaction.isPending || deleteTransaction.isPending

  const close = () => {
    reset()
    setConfirmingDelete(false)
    onClose()
  }

  const onSubmit = (data: FormData) => {
    const payload = {
      category: Number(data.category),
      amount: data.amount,
      date: data.date,
      paid_by: Number(data.paid_by),
      notes: data.notes,
    }
    const options = {
      onSuccess: () => {
        setLastCategoryId(space.id, payload.category)
        toast.success(transaction ? 'Transaction updated' : 'Transaction added')
        close()
      },
      onError: () => toast.error('Failed to save transaction. Please try again.'),
    }
    if (transaction) updateTransaction.mutate({ id: transaction.id, ...payload }, options)
    else createTransaction.mutate(payload, options)
  }

  const handleDelete = () => {
    deleteTransaction.mutate(transaction!.id, {
      onSuccess: () => {
        toast.success('Transaction deleted')
        close()
      },
      onError: () => toast.error('Failed to delete transaction. Please try again.'),
    })
  }

  const expenses = categories.filter((c) => !c.is_income)
  const income = categories.filter((c) => c.is_income)

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
          <DialogDescription>
            {transaction ? 'Change or delete this entry.' : 'Log an expense or income for this space.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2" noValidate>
          <div className="space-y-2">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input id="tx-amount" inputMode="decimal" placeholder="0.00" autoFocus {...register('amount')} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-category">Category</Label>
            <NativeSelect id="tx-category" {...register('category')}>
              <optgroup label="Expenses">
                {expenses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Income">
                {income.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </optgroup>
            </NativeSelect>
            {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Date</Label>
              <Input id="tx-date" type="date" {...register('date')} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-paid-by">Paid by</Label>
              <NativeSelect id="tx-paid-by" {...register('paid_by')}>
                {space.members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.display_name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-notes">Notes</Label>
            <Input id="tx-notes" placeholder="Optional" {...register('notes')} />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {transaction ? (
              confirmingDelete ? (
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
                    Confirm Delete
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                  Delete
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/features/budget`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget
git commit -m "feat(frontend): transaction add/edit dialog with smart defaults"
```

---

### Task 14: Frontend — TransactionsPage + route

**Files:**
- Create: `frontend/src/features/budget/TransactionsPage.tsx`
- Modify: `frontend/src/router/index.tsx` (replace the Transactions stub)
- Test: `frontend/src/features/budget/__tests__/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: `useSelectedSpace`, `NoSpaceState` (Task 12), `useTransactions`/`useCategories` (Task 11), `TransactionDialog` (Task 13), `formatMoney`, `currentMonth`/`stepMonth`/`formatMonth`/`formatDayHeading`, `NativeSelect`.
- Produces: `TransactionsPage` at `/budget/transactions`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/budget/__tests__/TransactionsPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { TransactionsPage } from '../TransactionsPage'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

const BASE = 'http://localhost:8000'

function renderPage() {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  useSpaceStore.setState({ selectedSpaceId: 1 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TransactionsPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('renders transactions grouped by day with payer names', async () => {
    /** Rows show category icon+name, payer display name from space members, day headings. */
    renderPage()
    expect(await screen.findByText(/🛒 Groceries/)).toBeInTheDocument()
    expect(screen.getByText(/Thu, May 14/)).toBeInTheDocument()
    expect(screen.getByText(/Tue, May 12/)).toBeInTheDocument()
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0)
    expect(screen.getByText('Other User')).toBeInTheDocument()
  })

  it('shows income green with a plus and the space currency symbol', async () => {
    /** The Salary row renders +$2,400.00 with the income style class. */
    renderPage()
    const income = await screen.findByText('+$2,400.00')
    expect(income).toHaveClass('text-green-600')
    expect(screen.getByText('$84.20')).toBeInTheDocument()
  })

  it('refetches when stepping the month', async () => {
    /** The ‹ button changes the month param in the API call. */
    const months: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/transactions/`, ({ request }) => {
        months.push(new URL(request.url).searchParams.get('month') ?? '')
        return HttpResponse.json([])
      })
    )
    renderPage()
    await screen.findByText(/no transactions in/i)
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await waitFor(() => expect(months.length).toBeGreaterThanOrEqual(2))
    expect(months[0]).not.toBe(months[months.length - 1])
  })

  it('filters by category', async () => {
    /** Picking a category adds category_id to the API call. */
    const urls: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/transactions/`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json([])
      })
    )
    renderPage()
    await screen.findByText(/no transactions in/i)
    await userEvent.selectOptions(await screen.findByLabelText(/filter by category/i), '1')
    await waitFor(() => expect(urls[urls.length - 1]).toContain('category_id=1'))
  })

  it('opens the add dialog from the header button', async () => {
    /** "+ Add" opens TransactionDialog in add mode. */
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(await screen.findByText('Add transaction')).toBeInTheDocument()
  })

  it('opens the edit dialog when a row is clicked', async () => {
    /** Clicking a transaction row opens the dialog pre-filled. */
    renderPage()
    await userEvent.click(await screen.findByText(/🍽️ Dining Out/))
    expect(await screen.findByText('Edit transaction')).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toHaveValue('32.50')
  })

  it('shows the no-space state when the user has no spaces', async () => {
    /** Without any space the page shows the shared empty state. */
    server.use(http.get(`${BASE}/api/spaces/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/create a space to start tracking your budget/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/features/budget/__tests__/TransactionsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

Create `frontend/src/features/budget/TransactionsPage.tsx`:

```tsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { currentMonth, stepMonth, formatMonth, formatDayHeading } from '@/lib/dates'
import { useCategories, useTransactions, type Transaction } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { TransactionDialog } from './TransactionDialog'

function groupByDay(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const groups: { date: string; items: Transaction[] }[] = []
  for (const t of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }
  return groups
}

export function TransactionsPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const [month, setMonth] = useState(currentMonth())
  const [categoryId, setCategoryId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data: categories = [] } = useCategories(space?.id ?? null)
  const { data: transactions = [], isLoading } = useTransactions(space?.id ?? null, {
    month,
    categoryId: categoryId ? Number(categoryId) : undefined,
  })

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const memberById = new Map(space.members.map((m) => [m.user.id, m.user.display_name]))
  const groups = groupByDay(transactions)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="previous month" onClick={() => setMonth(stepMonth(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="min-w-32 text-center text-lg font-bold">{formatMonth(month)}</h1>
          <Button variant="ghost" size="icon" aria-label="next month" onClick={() => setMonth(stepMonth(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
            aria-label="filter by category"
            className="w-40"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </NativeSelect>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No transactions in {formatMonth(month)}.</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.date}>
              <p className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {formatDayHeading(group.date)}
              </p>
              <Card>
                <CardContent className="divide-y divide-border py-0">
                  {group.items.map((t) => {
                    const category = categoryById.get(t.category)
                    const isIncome = category?.is_income ?? false
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/50"
                        onClick={() => setEditing(t)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {category ? `${category.icon} ${category.name}` : 'Unknown category'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {memberById.get(t.paid_by) ?? 'Unknown'}
                            {t.notes && ` · ${t.notes}`}
                          </p>
                        </div>
                        <span className={cn('text-sm font-semibold', isIncome && 'text-green-600 dark:text-green-400')}>
                          {isIncome ? `+${formatMoney(t.amount, space.currency)}` : formatMoney(t.amount, space.currency)}
                        </span>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <TransactionDialog
        open={dialogOpen || editing !== null}
        transaction={editing}
        space={space}
        categories={categories}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire the route**

In `frontend/src/router/index.tsx`:

1. Add the lazy import next to the other page imports:

```tsx
const TransactionsPage = lazy(() =>
  import('@/features/budget/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
)
```

2. Replace the stub line:

```tsx
          { path: '/budget/transactions', element: <ComingSoon title="Transactions" /> },
```

with:

```tsx
          {
            path: '/budget/transactions',
            element: (
              <Suspense fallback={<Loader />}>
                <TransactionsPage />
              </Suspense>
            ),
          },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run`
Expected: full suite PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget src/router/index.tsx
git commit -m "feat(frontend): transactions page with month view grouped by day"
```

---

### Task 15: Frontend — CategoriesPage + CategoryDialog + route

**Files:**
- Create: `frontend/src/features/budget/CategoryDialog.tsx`
- Create: `frontend/src/features/budget/CategoriesPage.tsx`
- Modify: `frontend/src/router/index.tsx` (replace the Categories stub)
- Test: `frontend/src/features/budget/__tests__/CategoriesPage.test.tsx`

**Interfaces:**
- Consumes: `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` (Task 11), `useSelectedSpace`, `NoSpaceState`.
- Produces: `CategoriesPage` at `/budget/categories`; `CategoryDialog` props `{ open: boolean; category: Category | null; spaceId: number; onClose: () => void }`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/budget/__tests__/CategoriesPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { CategoriesPage } from '../CategoriesPage'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

const BASE = 'http://localhost:8000'

function renderPage() {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  useSpaceStore.setState({ selectedSpaceId: 1 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CategoriesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CategoriesPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('splits categories into expense and income sections', async () => {
    /** Groceries/Dining Out sit under Expenses, Salary under Income. */
    renderPage()
    expect(await screen.findByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText(/Groceries/)).toBeInTheDocument()
    expect(screen.getByText(/Salary/)).toBeInTheDocument()
  })

  it('creates a category through the add dialog', async () => {
    /** The dialog POSTs name, icon and is_income. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/categories/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 99, ...posted }, { status: 201 })
      })
    )
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /add category/i }))
    await userEvent.type(screen.getByLabelText(/name/i), 'Pets')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(posted.name).toBe('Pets'))
    expect(posted.space_id).toBe(1)
    expect(posted.is_income).toBe(false)
  })

  it('edits a category through the pencil button', async () => {
    /** The edit dialog PATCHes the changed name. */
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${BASE}/api/budgets/categories/:id/`, async ({ request, params }) => {
        patched = { id: Number(params.id), ...((await request.json()) as Record<string, unknown>) }
        return HttpResponse.json(patched)
      })
    )
    renderPage()
    await screen.findByText(/Groceries/)
    await userEvent.click(screen.getByRole('button', { name: /edit groceries/i }))
    const nameInput = screen.getByLabelText(/name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Food')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(patched.name).toBe('Food'))
    expect(patched.id).toBe(1)
  })

  it('shows the backend detail message when delete returns 409', async () => {
    /** A protected category surfaces the 409 detail as an error toast. */
    server.use(
      http.delete(`${BASE}/api/budgets/categories/:id/`, () =>
        HttpResponse.json({ detail: 'This category has transactions and cannot be deleted.' }, { status: 409 })
      )
    )
    renderPage()
    await screen.findByText(/Groceries/)
    await userEvent.click(screen.getByRole('button', { name: /delete groceries/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    expect(await screen.findByText(/has transactions and cannot be deleted/i)).toBeInTheDocument()
  })
})
```

Note: the 409 toast is rendered by sonner — the test needs a `<Toaster />`. If the assertion fails because no toaster is mounted, add `<Toaster />` inside `renderPage`'s tree (import from `'sonner'`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/features/budget/__tests__/CategoriesPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/features/budget/CategoryDialog.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateCategory, useUpdateCategory, type Category } from '@/hooks/useBudget'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  category: Category | null
  spaceId: number
  onClose: () => void
}

export function CategoryDialog({ open, category, spaceId, onClose }: Props) {
  const createCategory = useCreateCategory(spaceId)
  const updateCategory = useUpdateCategory(spaceId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormData & { is_income: boolean }>({
    resolver: zodResolver(schema),
    values: {
      name: category?.name ?? '',
      icon: category?.icon ?? '📦',
      is_income: category?.is_income ?? false,
    },
  })
  const isIncome = watch('is_income')
  const isPending = createCategory.isPending || updateCategory.isPending

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (data: FormData & { is_income: boolean }) => {
    const options = {
      onSuccess: () => {
        toast.success(category ? 'Category updated' : 'Category added')
        close()
      },
      onError: () => toast.error('Failed to save category. Please try again.'),
    }
    if (category) updateCategory.mutate({ id: category.id, ...data }, options)
    else createCategory.mutate(data, options)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
          <DialogDescription>Categories organize this space&apos;s transactions.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2" noValidate>
          <div className="grid grid-cols-[5rem_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-icon">Icon</Label>
              <Input id="cat-icon" maxLength={4} {...register('icon')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" placeholder="e.g. Pets" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="cat-income" checked={isIncome} onCheckedChange={(v) => setValue('is_income', v)} />
            <Label htmlFor="cat-income">This is income</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

Create `frontend/src/features/budget/CategoriesPage.tsx`:

```tsx
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories, useDeleteCategory, type Category } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { CategoryDialog } from './CategoryDialog'

function CategoryRow({
  category,
  onEdit,
  onDelete,
  deleting,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex items-center gap-3 py-2.5">
      <p className="flex-1 text-sm font-medium">
        {category.icon} {category.name}
      </p>
      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={() => {
              onDelete()
              setConfirming(false)
            }}
          >
            Confirm Delete
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <>
          <Button variant="ghost" size="icon" aria-label={`edit ${category.name}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`delete ${category.name}`} onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

function CategorySection({
  title,
  categories,
  onEdit,
  onDelete,
  deleting,
}: {
  title: string
  categories: Category[]
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  deleting: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {categories.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onEdit={() => onEdit(c)}
              onDelete={() => onDelete(c)}
              deleting={deleting}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function CategoriesPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const { data: categories = [], isLoading } = useCategories(space?.id ?? null)
  const deleteCategory = useDeleteCategory(space?.id ?? 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  if (spaceLoading || isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const handleDelete = (category: Category) => {
    deleteCategory.mutate(category.id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: (error) => {
        const detail =
          isAxiosError(error) && error.response?.status === 409
            ? (error.response.data as { detail: string }).detail
            : 'Failed to delete category. Please try again.'
        toast.error(detail)
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">Organize spending and income in {space.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </div>

      <CategorySection
        title="Expenses"
        categories={categories.filter((c) => !c.is_income)}
        onEdit={setEditing}
        onDelete={handleDelete}
        deleting={deleteCategory.isPending}
      />
      <CategorySection
        title="Income"
        categories={categories.filter((c) => c.is_income)}
        onEdit={setEditing}
        onDelete={handleDelete}
        deleting={deleteCategory.isPending}
      />

      <CategoryDialog
        open={dialogOpen || editing !== null}
        category={editing}
        spaceId={space.id}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire the route**

In `frontend/src/router/index.tsx`, add the lazy import and replace the Categories stub (same pattern as Task 14 Step 4):

```tsx
const CategoriesPage = lazy(() =>
  import('@/features/budget/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
)
```

```tsx
          {
            path: '/budget/categories',
            element: (
              <Suspense fallback={<Loader />}>
                <CategoriesPage />
              </Suspense>
            ),
          },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run`
Expected: full suite PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget src/router/index.tsx
git commit -m "feat(frontend): categories page with expense/income sections and CRUD"
```

---

### Task 16: Frontend — RecurringPage + RecurringDialog + route

**Files:**
- Create: `frontend/src/features/budget/RecurringDialog.tsx`
- Create: `frontend/src/features/budget/RecurringPage.tsx`
- Modify: `frontend/src/router/index.tsx` (replace the Recurring stub)
- Test: `frontend/src/features/budget/__tests__/RecurringPage.test.tsx`

**Interfaces:**
- Consumes: `useRecurring`, `useCreateRecurring`, `useUpdateRecurring`, `useDeleteRecurring`, `useCategories` (Task 11), `Switch` (Task 7), `formatMoney`, `formatDayHeading`.
- Produces: `RecurringPage` at `/budget/recurring`; `RecurringDialog` props `{ open: boolean; recurring: RecurringTransaction | null; spaceId: number; categories: Category[]; onClose: () => void }`. On create, `next_due_date` is sent equal to `start_date`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/budget/__tests__/RecurringPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { RecurringPage } from '../RecurringPage'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

const BASE = 'http://localhost:8000'

function renderPage() {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  useSpaceStore.setState({ selectedSpaceId: 1 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RecurringPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RecurringPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('lists recurring transactions with amount, frequency and next date', async () => {
    /** The Rent template shows its amount, monthly frequency and next due date. */
    renderPage()
    expect(await screen.findByText(/Rent/)).toBeInTheDocument()
    expect(screen.getByText('$950.00')).toBeInTheDocument()
    expect(screen.getByText(/monthly/i)).toBeInTheDocument()
    expect(screen.getByText(/Aug 1/)).toBeInTheDocument()
  })

  it('toggles is_active from the row switch', async () => {
    /** Flipping the switch PATCHes is_active without opening the dialog. */
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${BASE}/api/budgets/recurring-transactions/:id/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 1, ...patched })
      })
    )
    renderPage()
    await screen.findByText(/Rent/)
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(patched).toEqual({ is_active: false }))
  })

  it('creates a recurring transaction with next_due_date equal to start_date', async () => {
    /** The add dialog POSTs next_due_date = start_date. */
    let posted: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/api/budgets/recurring-transactions/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 99, ...posted }, { status: 201 })
      })
    )
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /add recurring/i }))
    await userEvent.type(screen.getByLabelText(/amount/i), '15.99')
    await userEvent.type(screen.getByLabelText(/description/i), 'Netflix')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(posted.description).toBe('Netflix'))
    expect(posted.next_due_date).toBe(posted.start_date)
    expect(posted.space_id).toBe(1)
  })

  it('opens the edit dialog from a row and deletes with confirmation', async () => {
    /** Clicking the row body opens edit mode; Delete → Confirm Delete removes it. */
    let deleted = false
    server.use(
      http.delete(`${BASE}/api/budgets/recurring-transactions/:id/`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    renderPage()
    await userEvent.click(await screen.findByText(/Rent/))
    expect(await screen.findByText('Edit recurring transaction')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(deleted).toBe(true))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/features/budget/__tests__/RecurringPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/features/budget/RecurringDialog.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
  type Category,
  type RecurringTransaction,
} from '@/hooks/useBudget'
import { formatDayHeading } from '@/lib/dates'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a positive amount'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  start_date: z.string().min(1, 'Start date is required'),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  recurring: RecurringTransaction | null
  spaceId: number
  categories: Category[]
  onClose: () => void
}

export function RecurringDialog({ open, recurring, spaceId, categories, onClose }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const createRecurring = useCreateRecurring(spaceId)
  const updateRecurring = useUpdateRecurring(spaceId)
  const deleteRecurring = useDeleteRecurring(spaceId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      amount: recurring?.amount ?? '',
      category: String(recurring?.category ?? categories.find((c) => !c.is_income)?.id ?? ''),
      description: recurring?.description ?? '',
      frequency: recurring?.frequency ?? 'monthly',
      start_date: recurring?.start_date ?? new Date().toISOString().slice(0, 10),
    },
  })

  const isPending = createRecurring.isPending || updateRecurring.isPending || deleteRecurring.isPending

  const close = () => {
    reset()
    setConfirmingDelete(false)
    onClose()
  }

  const onSubmit = (data: FormData) => {
    const options = {
      onSuccess: () => {
        toast.success(recurring ? 'Recurring transaction updated' : 'Recurring transaction added')
        close()
      },
      onError: () => toast.error('Failed to save. Please try again.'),
    }
    const payload = {
      category: Number(data.category),
      amount: data.amount,
      description: data.description,
      frequency: data.frequency,
      start_date: data.start_date,
    }
    if (recurring) updateRecurring.mutate({ id: recurring.id, ...payload }, options)
    else createRecurring.mutate({ ...payload, next_due_date: data.start_date }, options)
  }

  const handleDelete = () => {
    deleteRecurring.mutate(recurring!.id, {
      onSuccess: () => {
        toast.success('Recurring transaction deleted')
        close()
      },
      onError: () => toast.error('Failed to delete. Please try again.'),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recurring ? 'Edit recurring transaction' : 'Add recurring transaction'}</DialogTitle>
          <DialogDescription>Templates that add real transactions automatically when due.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2" noValidate>
          <div className="space-y-2">
            <Label htmlFor="rec-description">Description</Label>
            <Input id="rec-description" placeholder="e.g. Rent" {...register('description')} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rec-amount">Amount</Label>
              <Input id="rec-amount" inputMode="decimal" placeholder="0.00" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-category">Category</Label>
              <NativeSelect id="rec-category" {...register('category')}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rec-frequency">Frequency</Label>
              <NativeSelect id="rec-frequency" {...register('frequency')}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-start">Start date</Label>
              <Input id="rec-start" type="date" {...register('start_date')} />
              {errors.start_date && <p className="text-sm text-destructive">{errors.start_date.message}</p>}
            </div>
          </div>
          {recurring && (
            <p className="text-xs text-muted-foreground">Next due: {formatDayHeading(recurring.next_due_date)}</p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {recurring ? (
              confirmingDelete ? (
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
                    Confirm Delete
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                  Delete
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

Create `frontend/src/features/budget/RecurringPage.tsx`:

```tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { formatDayHeading } from '@/lib/dates'
import { useCategories, useRecurring, useUpdateRecurring, type RecurringTransaction } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { RecurringDialog } from './RecurringDialog'

export function RecurringPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const { data: recurring = [], isLoading } = useRecurring(space?.id ?? null)
  const { data: categories = [] } = useCategories(space?.id ?? null)
  const updateRecurring = useUpdateRecurring(space?.id ?? 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)

  if (spaceLoading || isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const handleToggle = (item: RecurringTransaction, checked: boolean) => {
    updateRecurring.mutate(
      { id: item.id, is_active: checked },
      { onError: () => toast.error('Failed to update. Please try again.') }
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Recurring</h1>
          <p className="text-sm text-muted-foreground">Repeating expenses and income in {space.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add recurring
        </Button>
      </div>

      {recurring.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No recurring transactions yet.</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add recurring
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border py-0">
            {recurring.map((item) => {
              const category = categoryById.get(item.category)
              return (
                <div key={item.id} className={cn('flex items-center gap-3 py-2.5', !item.is_active && 'opacity-50')}>
                  <button type="button" className="flex-1 text-left" onClick={() => setEditing(item)}>
                    <p className="text-sm font-medium">
                      {category?.icon} {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.frequency} · {item.is_active ? `next: ${formatDayHeading(item.next_due_date)}` : 'paused'}
                    </p>
                  </button>
                  <span className="text-sm font-semibold">{formatMoney(item.amount, space.currency)}</span>
                  <Switch
                    checked={item.is_active}
                    aria-label={`toggle ${item.description}`}
                    onCheckedChange={(checked) => handleToggle(item, checked)}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Recurring transactions are added to your history automatically when they come due.
      </p>

      <RecurringDialog
        open={dialogOpen || editing !== null}
        recurring={editing}
        spaceId={space.id}
        categories={categories}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire the route**

In `frontend/src/router/index.tsx`, add the lazy import and replace the Recurring stub (same pattern as Task 14 Step 4):

```tsx
const RecurringPage = lazy(() => import('@/features/budget/RecurringPage').then((m) => ({ default: m.RecurringPage })))
```

```tsx
          {
            path: '/budget/recurring',
            element: (
              <Suspense fallback={<Loader />}>
                <RecurringPage />
              </Suspense>
            ),
          },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run`
Expected: full suite PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget src/router/index.tsx
git commit -m "feat(frontend): recurring transactions page with pause toggle"
```

---

### Task 17: Frontend — ReportsPage + Recharts + route

**Files:**
- Modify: `frontend/package.json` (add `recharts`)
- Create: `frontend/src/features/budget/ReportsPage.tsx`
- Modify: `frontend/src/router/index.tsx` (replace the Reports stub)
- Test: `frontend/src/features/budget/__tests__/ReportsPage.test.tsx`

**Interfaces:**
- Consumes: `useReport`, `useCategories` (Task 11), `Tabs`/`TabsList`/`TabsTrigger` (Task 7), date helpers (Task 6), `formatMoney`.
- Produces: `ReportsPage` at `/budget/reports`. Income/expense split computed by joining `ReportRow.category_id` against `useCategories` data (the report response has no `is_income`).

- [ ] **Step 1: Install recharts**

```bash
pnpm add recharts
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/features/budget/__tests__/ReportsPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { mockReport } from '@/mocks/handlers'
import { ReportsPage } from '../ReportsPage'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

const BASE = 'http://localhost:8000'

function renderPage() {
  useAuthStore.setState({
    user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
  useSpaceStore.setState({ selectedSpaceId: 1 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReportsPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    useSpaceStore.setState({ selectedSpaceId: null })
  })

  it('computes income, expenses and net by joining categories', async () => {
    /** Salary (income) 2400 vs Groceries+Dining 116.70 → net +2,283.30. */
    renderPage()
    expect(await screen.findByText('$2,400.00')).toBeInTheDocument()
    expect(screen.getByText('$116.70')).toBeInTheDocument()
    expect(screen.getByText('+$2,283.30')).toBeInTheDocument()
  })

  it('lists expense categories with percentage share', async () => {
    /** Groceries is 84.20 of 116.70 ≈ 72%. */
    renderPage()
    expect(await screen.findByText(/🛒 Groceries/)).toBeInTheDocument()
    expect(screen.getByText(/72%/)).toBeInTheDocument()
  })

  it('defaults to the monthly report', async () => {
    /** On load the month endpoint is called. */
    let url = ''
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, ({ request }) => {
        url = request.url
        return HttpResponse.json(mockReport)
      })
    )
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    expect(url).toContain('monthly-summary')
  })

  it('switches to the weekly report via tabs', async () => {
    /** Clicking Week hits weekly-summary with a week param. */
    const urls: string[] = []
    server.use(
      http.get(`${BASE}/api/budgets/reports/:reportType/`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json(mockReport)
      })
    )
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    await userEvent.click(screen.getByRole('tab', { name: /week/i }))
    await waitFor(() => expect(urls.some((u) => u.includes('weekly-summary'))).toBe(true))
    expect(urls[urls.length - 1]).toMatch(/week=\d{4}-\d{2}-\d{2}/)
  })

  it('shows an empty state when the period has no data', async () => {
    /** An empty report renders the no-data message. */
    server.use(http.get(`${BASE}/api/budgets/reports/:reportType/`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/no data for this period/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test:run src/features/budget/__tests__/ReportsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `frontend/src/features/budget/ReportsPage.tsx`:

```tsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { currentMonth, stepMonth, formatMonth, currentWeekStart, stepWeek, formatWeekRange } from '@/lib/dates'
import { useCategories, useReport, type ReportPeriodType, type ReportRow } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b']

function usePeriod() {
  const [type, setType] = useState<ReportPeriodType>('month')
  const [month, setMonth] = useState(currentMonth())
  const [week, setWeek] = useState(currentWeekStart())
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const value = type === 'month' ? month : type === 'week' ? week : year
  const label = type === 'month' ? formatMonth(month) : type === 'week' ? formatWeekRange(week) : year

  const step = (delta: number) => {
    if (type === 'month') setMonth(stepMonth(month, delta))
    else if (type === 'week') setWeek(stepWeek(week, delta))
    else setYear(String(Number(year) + delta))
  }

  return { type, setType, value, label, step }
}

function SummaryCard({ title, value, className }: { title: string; value: string; className?: string }) {
  return (
    <Card className="flex-1">
      <CardContent className="py-4 text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
        <p className={cn('mt-1 text-lg font-bold', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}

export function ReportsPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const { type, setType, value, label, step } = usePeriod()
  const { data: categories = [] } = useCategories(space?.id ?? null)
  const { data: rows = [], isLoading } = useReport(space?.id ?? null, type, value)

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const incomeCategoryIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id))
  const expenseRows: ReportRow[] = rows.filter((r) => !incomeCategoryIds.has(r.category_id))
  const incomeRows: ReportRow[] = rows.filter((r) => incomeCategoryIds.has(r.category_id))
  const expenseTotal = expenseRows.reduce((sum, r) => sum + Number(r.total), 0)
  const incomeTotal = incomeRows.reduce((sum, r) => sum + Number(r.total), 0)
  const net = incomeTotal - expenseTotal

  const chartData = expenseRows.map((r) => ({ name: r.category_name, value: Number(r.total) }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={type} onValueChange={(v) => setType(v as ReportPeriodType)}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="previous period" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold">{label}</span>
          <Button variant="ghost" size="icon" aria-label="next period" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No data for this period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-3">
            <SummaryCard title="Income" value={formatMoney(incomeTotal, space.currency)} className="text-green-600 dark:text-green-400" />
            <SummaryCard title="Expenses" value={formatMoney(expenseTotal, space.currency)} />
            <SummaryCard
              title="Net"
              value={`${net >= 0 ? '+' : ''}${formatMoney(net, space.currency)}`}
              className={net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}
            />
          </div>

          {expenseRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Expenses by category
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
                <PieChart width={220} height={220}>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="w-full flex-1 space-y-1">
                  {expenseRows.map((r) => (
                    <div key={r.category_id} className="flex items-center justify-between py-1 text-sm">
                      <span>
                        {r.category_icon} {r.category_name}
                      </span>
                      <span className="font-semibold">
                        {formatMoney(r.total, space.currency)}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {expenseTotal > 0 ? Math.round((Number(r.total) / expenseTotal) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {incomeRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Income
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {incomeRows.map((r) => (
                  <div key={r.category_id} className="flex items-center justify-between py-1 text-sm">
                    <span>
                      {r.category_icon} {r.category_name}
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      +{formatMoney(r.total, space.currency)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Wire the route**

In `frontend/src/router/index.tsx`, add the lazy import and replace the Reports stub (same pattern as Task 14 Step 4):

```tsx
const ReportsPage = lazy(() => import('@/features/budget/ReportsPage').then((m) => ({ default: m.ReportsPage })))
```

```tsx
          {
            path: '/budget/reports',
            element: (
              <Suspense fallback={<Loader />}>
                <ReportsPage />
              </Suspense>
            ),
          },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test:run`
Expected: full suite PASS.

- [ ] **Step 7: Lint and commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget src/router/index.tsx package.json pnpm-lock.yaml
git commit -m "feat(frontend): reports page with period switcher, summary cards and donut chart"
```

---

### Task 18: Docs + final verification

**Files:**
- Modify: `CLAUDE.md` (architecture + API routes sections)

**Interfaces:** none — documentation and verification only.

- [ ] **Step 1: Update CLAUDE.md**

In the **Frontend** architecture section, after the `src/features/settings/` bullet, add:

```markdown
- **`src/features/budget/`** — TransactionsPage (month view grouped by day), CategoriesPage, RecurringPage, ReportsPage (Recharts donut). All scoped to `spaceStore.selectedSpaceId` via `useSelectedSpace`; `NoSpaceState` renders when the user has no space. Amounts formatted with `src/lib/money.ts` (`Intl.NumberFormat`, `narrowSymbol`) using the space's `currency`.
```

In the **API routes** section, after the `PATCH /api/auth/me/` line, add:

```markdown
`PATCH /api/spaces/{id}/` — owner/admin updates space settings (`name`, `currency`). Spaces carry a `currency` ISO code (default `USD`) chosen at creation.
`DELETE /api/budgets/categories/{id}/` — returns `409` if the category has transactions.
```

- [ ] **Step 2: Run both full suites**

```bash
cd backend && uv run pytest && uv run black --check . && uv run isort --check-only . && uv run flake8 .
cd ../frontend && pnpm test:run && pnpm lint && pnpm format:check
```

Expected: everything passes.

- [ ] **Step 3: Manual smoke test (optional but recommended)**

Start backend (`uv run python manage.py runserver --settings=config.settings.local`) and frontend (`pnpm dev`), then: create a space picking a non-USD currency → add a transaction (check symbol) → change currency in Space Settings (check all pages update) → add a category → pause a recurring item → check all three report periods.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document budget section and space currency in CLAUDE.md"
```
