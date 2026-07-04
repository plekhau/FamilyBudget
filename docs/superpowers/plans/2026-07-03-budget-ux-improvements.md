# Budget Section UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ten UX improvements from `docs/superpowers/specs/2026-07-03-budget-ux-improvements-design.md`: Transactions totals, Reports chart legend/colors/tooltip, responsive summary cards, comma-tolerant amount inputs with currency symbol, per-space formatting locale, conditional Today button, and small fixes (frequency labels, Cancel buttons, category transaction counts).

**Architecture:** Two small backend slices (a `Space.locale` field and a `transaction_count` annotation on the category list) plus frontend changes contained in the existing budget/spaces feature files and `src/lib`. No new pages, no new endpoints.

**Tech Stack:** Django 5 + DRF + pytest (backend, run from `backend/` with `uv`); React 19 + Vite + Vitest + MSW + Tailwind v4 + Recharts (frontend, run from `frontend/` with `pnpm`).

## Global Constraints

- Backend commands run from `backend/`: `uv run pytest ...`; management commands need `--settings=config.settings.local`.
- Frontend commands run from `frontend/`: `pnpm test --run ...`, and **before every frontend commit** run `pnpm lint:fix && pnpm format`. Lint must produce zero warnings.
- Every test (pytest and Vitest) has a docstring explaining what it verifies. No imports inside test functions.
- Supported locales, exactly: `en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `pl-PL`, `ru-RU`, plus empty string meaning "Auto (browser)".
- Copy strings verbatim: `Enter a positive amount, e.g. 12.50` · `Cancel` · `Today` · `Auto (browser)` · `Formatting` · `Other`.
- Date formatters default to `'en-US'` when no locale is passed (backward compatible); pages pass `spaceLocale(space)`.
- `CHART_COLORS` (12, no grays): `#6366f1 #f59e0b #10b981 #ef4444 #8b5cf6 #14b8a6 #f97316 #ec4899 #06b6d4 #84cc16 #f43f5e #0ea5e9`. Reserved "Other" gray: `#9ca3af`.

---

### Task 1: Backend — `Space.locale` field

**Files:**
- Modify: `backend/apps/spaces/models.py` (Space model, ~line 9)
- Modify: `backend/apps/spaces/serializers.py` (SpaceSerializer, ~lines 25-37)
- Create: migration via `makemigrations`
- Test: `backend/tests/spaces/test_space_update.py` (append)

**Interfaces:**
- Consumes: existing `PATCH /api/spaces/{id}/` (owner/admin permission already enforced in `SpaceDetailView.get_permissions`).
- Produces: `Space.locale: str` (blank default `""`), serialized as `locale` in every space payload. Frontend Task 4 relies on the field name `locale` and the supported-locale list.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/spaces/test_space_update.py`, inside `TestSpaceUpdate`:

```python
    @pytest.mark.parametrize("locale", ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "pl-PL", "ru-RU", ""])
    def test_owner_can_update_locale(self, auth_client, locale):
        """The owner can PATCH any supported locale, including '' meaning auto."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"locale": locale})
        assert response.status_code == 200
        assert response.data["locale"] == locale

    def test_unsupported_locale_rejected(self, auth_client):
        """PATCHing a locale outside the supported list returns 400."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"locale": "xx-XX"})
        assert response.status_code == 400

    def test_locale_defaults_to_empty(self, auth_client):
        """A newly created space has locale '' (auto) in its payload."""
        response = auth_client.post("/api/spaces/", {"name": "Home"})
        assert response.data["locale"] == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/spaces/test_space_update.py -v`
Expected: the new tests FAIL (KeyError `'locale'` / 400 assertions), existing ones pass.

- [ ] **Step 3: Implement model + serializer**

In `backend/apps/spaces/models.py`, after the `currency` field on `Space`:

```python
    locale = models.CharField(max_length=10, blank=True, default="")
```

In `backend/apps/spaces/serializers.py`, module level (above `SpaceSerializer`):

```python
SUPPORTED_LOCALES = ("en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "pl-PL", "ru-RU")
```

In `SpaceSerializer.Meta`, change `fields` to:

```python
        fields = ("id", "name", "currency", "locale", "created_at", "members")
```

Add below `validate_currency`:

```python
    def validate_locale(self, value):
        if value and value not in SUPPORTED_LOCALES:
            raise serializers.ValidationError("Unsupported locale.")
        return value
```

- [ ] **Step 4: Create and apply the migration**

```bash
uv run python manage.py makemigrations spaces --settings=config.settings.local
uv run python manage.py migrate --settings=config.settings.local
```

Expected: one new migration adding `locale` to `space`.

- [ ] **Step 5: Run the backend suite**

Run: `uv run pytest`
Expected: all pass. (Other space tests serialize the new field harmlessly.)

- [ ] **Step 6: Commit**

```bash
git add apps/spaces tests/spaces
git commit -m "feat(backend): per-space formatting locale field"
```

---

### Task 2: Backend — category `transaction_count`

**Files:**
- Modify: `backend/apps/budgets/views.py` (`CategoryListCreateView.get_queryset`, ~line 33)
- Modify: `backend/apps/budgets/serializers.py` (`CategorySerializer`, lines 6-10)
- Test: `backend/tests/budgets/test_categories.py` (append)

**Interfaces:**
- Consumes: `Category.transactions` reverse relation (`related_name="transactions"` on `Transaction.category`).
- Produces: `transaction_count: int` on every serialized category. Frontend Task 9 relies on this exact field name.

- [ ] **Step 1: Write the failing test**

Append to `TestCategoryAPI` in `backend/tests/budgets/test_categories.py`:

```python
    def test_list_includes_transaction_count(self, auth_client, space_id):
        """Each listed category carries transaction_count: 0 when unused, N after transactions exist."""
        categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}").data
        assert all(c["transaction_count"] == 0 for c in categories)
        cat_id = categories[0]["id"]
        me = auth_client.get("/api/auth/me/").data
        for day in ("2026-07-01", "2026-07-02"):
            response = auth_client.post(
                "/api/budgets/transactions/",
                {"space_id": space_id, "category": cat_id, "amount": "10.00", "date": day, "paid_by": me["id"], "notes": ""},
            )
            assert response.status_code == 201
        categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}").data
        by_id = {c["id"]: c["transaction_count"] for c in categories}
        assert by_id[cat_id] == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/budgets/test_categories.py::TestCategoryAPI::test_list_includes_transaction_count -v`
Expected: FAIL with `KeyError: 'transaction_count'`.

- [ ] **Step 3: Implement annotation + serializer field**

`backend/apps/budgets/views.py` — add `Count` to the imports and annotate the list queryset:

```python
from django.db.models import Count
```

In `CategoryListCreateView.get_queryset`, change the return to:

```python
        return Category.objects.filter(space=space).annotate(transaction_count=Count("transactions"))
```

`backend/apps/budgets/serializers.py` — replace `CategorySerializer` with:

```python
class CategorySerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "icon", "is_income", "transaction_count")
        read_only_fields = ("id",)

    def get_transaction_count(self, obj):
        count = getattr(obj, "transaction_count", None)
        return count if count is not None else obj.transactions.count()
```

(The `getattr` fallback covers detail/create responses whose instances are not annotated.)

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/budgets/ -v`
Expected: all pass, including create/update/detail category tests (fallback path).

- [ ] **Step 5: Commit**

```bash
git add apps/budgets tests/budgets
git commit -m "feat(backend): annotate categories with transaction_count"
```

---

### Task 3: Frontend lib — `currencySymbol`, locale-aware dates, `spaceLocale`

**Files:**
- Modify: `frontend/src/lib/money.ts`
- Modify: `frontend/src/lib/dates.ts`
- Create: `frontend/src/lib/locale.ts`
- Test: `frontend/src/lib/__tests__/money.test.ts`, `frontend/src/lib/__tests__/dates.test.ts`, create `frontend/src/lib/__tests__/locale.test.ts`

**Interfaces:**
- Produces (used by Tasks 4-9):
  - `currencySymbol(currency: string, locale?: string): string` in `@/lib/money`
  - `formatMonth(month: string, locale?: string)`, `formatDayHeading(date: string, locale?: string)`, `formatWeekRange(weekStart: string, locale?: string)` — all defaulting to `'en-US'`
  - `SUPPORTED_LOCALES: { code: string; label: string }[]` and `spaceLocale(space: { locale?: string }): string` in `@/lib/locale`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/__tests__/money.test.ts`:

```ts
import { currencySymbol } from '../money'

describe('currencySymbol', () => {
  it('returns the narrow symbol for common currencies', () => {
    /** USD→$ and EUR→€ using the narrowSymbol display. */
    expect(currencySymbol('USD', 'en-US')).toBe('$')
    expect(currencySymbol('EUR', 'de-DE')).toBe('€')
  })

  it('falls back to the code for unknown-symbol currencies', () => {
    /** A currency Intl renders as its code still yields a non-empty string. */
    expect(currencySymbol('CHF', 'en-US').length).toBeGreaterThan(0)
  })
})
```

Append to `frontend/src/lib/__tests__/dates.test.ts`:

```ts
describe('locale-aware formatting', () => {
  it('formats the month heading in the given locale', () => {
    /** formatMonth honors an explicit locale and defaults to en-US. */
    expect(formatMonth('2026-07', 'de-DE')).toBe('Juli 2026')
    expect(formatMonth('2026-07')).toBe('July 2026')
  })

  it('formats day headings in the given locale', () => {
    /** formatDayHeading renders localized weekday/month names. */
    expect(formatDayHeading('2026-07-06', 'de-DE')).toMatch(/Juli/)
    expect(formatDayHeading('2026-07-06')).toBe('Mon, Jul 6')
  })

  it('formats week ranges in the given locale', () => {
    /** formatWeekRange uses localized month names. */
    expect(formatWeekRange('2026-06-29', 'de-DE')).toMatch(/Juli 2026/)
  })
})
```

(Reuse the existing imports at the top of the file — add any missing names to the existing `import` statement rather than a new one.)

Create `frontend/src/lib/__tests__/locale.test.ts`:

```ts
import { spaceLocale, SUPPORTED_LOCALES } from '../locale'

describe('spaceLocale', () => {
  it('returns the space locale when set', () => {
    /** A non-empty space locale wins over the browser locale. */
    expect(spaceLocale({ locale: 'de-DE' })).toBe('de-DE')
  })

  it('falls back to navigator.language when unset', () => {
    /** Empty string or undefined means auto (browser). */
    expect(spaceLocale({ locale: '' })).toBe(navigator.language)
    expect(spaceLocale({})).toBe(navigator.language)
  })
})

describe('SUPPORTED_LOCALES', () => {
  it('starts with the auto option', () => {
    /** The first entry is the empty-code Auto (browser) option. */
    expect(SUPPORTED_LOCALES[0]).toEqual({ code: '', label: 'Auto (browser)' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/lib`
Expected: new tests FAIL (missing exports / wrong signature).

- [ ] **Step 3: Implement**

Append to `frontend/src/lib/money.ts`:

```ts
export function currencySymbol(currency: string, locale: string = navigator.language): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}
```

In `frontend/src/lib/dates.ts`, change the three display formatters to accept a locale (keep everything else untouched):

```ts
export function formatMonth(month: string, locale: string = 'en-US'): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDayHeading(date: string, locale: string = 'en-US'): string {
  return toUTC(date).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatWeekRange(weekStart: string, locale: string = 'en-US'): string {
  const start = toUTC(weekStart)
  const end = new Date(start.getTime() + 6 * DAY_MS)
  const opts = { timeZone: 'UTC' } as const
  const year = end.toLocaleDateString(locale, { year: 'numeric', ...opts })
  if (start.getUTCMonth() === end.getUTCMonth()) {
    const month = end.toLocaleDateString(locale, { month: 'short', ...opts })
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month} ${year}`
  }
  const startLabel = `${start.getUTCDate()} ${start.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}`
  const endLabel = `${end.getUTCDate()} ${end.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}`
  return `${startLabel} – ${endLabel} ${year}`
}
```

Create `frontend/src/lib/locale.ts`:

```ts
export const SUPPORTED_LOCALES = [
  { code: '', label: 'Auto (browser)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'ru-RU', label: 'Russian' },
]

export function spaceLocale(space: { locale?: string }): string {
  return space.locale || navigator.language
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test --run src/lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src/lib
git commit -m "feat(frontend): currencySymbol, locale-aware date formatters, spaceLocale helper"
```

---

### Task 4: Frontend — locale plumbing (Space type, mocks, SpacesPage select, page formatters)

**Files:**
- Modify: `frontend/src/hooks/useSpaces.ts` (`Space` interface, `useUpdateSpace`)
- Modify: `frontend/src/mocks/handlers.ts` (space payloads)
- Modify: `frontend/src/features/spaces/SpacesPage.tsx` (`SpaceSettingsCard`)
- Modify: `frontend/src/features/budget/TransactionsPage.tsx`, `ReportsPage.tsx`, `RecurringPage.tsx` (pass locale to formatters)
- Test: `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx`, `frontend/src/features/budget/__tests__/TransactionsPage.test.tsx` (append)

**Interfaces:**
- Consumes: `spaceLocale`, `SUPPORTED_LOCALES` from Task 3; backend `locale` field from Task 1.
- Produces: `Space.locale: string` on the frontend type; every budget page resolves `const locale = spaceLocale(space)` and passes it to `formatMonth` / `formatDayHeading` / `formatWeekRange` / `formatMoney`. Tasks 5-8 assume the `locale` const exists in these components.

- [ ] **Step 1: Write the failing tests**

Append to the `describe` in `frontend/src/features/spaces/__tests__/SpacesPage.test.tsx` (reuse that file's existing render helper and `server`/`http`/`HttpResponse` imports — add imports to existing statements if missing):

```tsx
  it('saves the formatting locale from space settings', async () => {
    /** Picking German in the Formatting select PATCHes locale=de-DE. */
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.patch(`${BASE}/api/spaces/:id/`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json({
          id: 1,
          name: 'Home Budget',
          currency: 'USD',
          locale: 'de-DE',
          created_at: '2026-01-01T00:00:00Z',
          members: [],
        })
      })
    )
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText(/formatting/i), 'de-DE')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(bodies[0]).toMatchObject({ locale: 'de-DE' }))
  })
```

Append to `frontend/src/features/budget/__tests__/TransactionsPage.test.tsx`:

```tsx
  it('formats dates and money using the space locale', async () => {
    /** A space with locale de-DE renders German day headings. */
    server.use(
      http.get(`${BASE}/api/spaces/`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'Home Budget',
            currency: 'EUR',
            locale: 'de-DE',
            created_at: '2026-01-01T00:00:00Z',
            members: [
              {
                id: 1,
                user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
                role: 'owner',
                joined_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ])
      )
    )
    renderPage()
    expect(await screen.findByText(/Mai/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/spaces src/features/budget/__tests__/TransactionsPage.test.tsx`
Expected: the two new tests FAIL (no Formatting select; headings stay English).

- [ ] **Step 3: Implement**

`frontend/src/hooks/useSpaces.ts`:
- `Space` interface: add `locale: string` after `currency`.
- `useUpdateSpace` mutation input type: `{ id: number; name?: string; currency?: string; locale?: string }`.

`frontend/src/mocks/handlers.ts`: add `locale: ''` next to every `currency` in the space payloads (GET `/api/spaces/` object, POST response, PATCH response — the PATCH response should echo `body.locale ?? ''`).

`frontend/src/features/spaces/SpacesPage.tsx` — replace `SpaceSettingsCard` with:

```tsx
function SpaceSettingsCard({ space }: { space: Space }) {
  const [currency, setCurrency] = useState(space.currency)
  const [locale, setLocale] = useState(space.locale)
  const updateSpace = useUpdateSpace()
  const dirty = currency !== space.currency || locale !== space.locale

  const handleSave = () => {
    updateSpace.mutate(
      { id: space.id, currency, locale },
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
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-currency">Currency</Label>
            <NativeSelect id="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-locale">Formatting</Label>
            <NativeSelect id="settings-locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!dirty || updateSpace.isPending}>
          {updateSpace.isPending ? 'Saving…' : 'Save'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Changes how amounts and dates are displayed for everyone in this space. Existing amounts are not converted.
        </p>
      </CardContent>
    </Card>
  )
}
```

Add `import { SUPPORTED_LOCALES } from '@/lib/locale'` to the file's imports.

Budget pages — after the `if (!space) return <NoSpaceState />` guard in each of `TransactionsPage.tsx`, `ReportsPage.tsx`, `RecurringPage.tsx`, add:

```tsx
  const locale = spaceLocale(space)
```

with `import { spaceLocale } from '@/lib/locale'`, and pass it through:
- TransactionsPage: `formatMonth(month, locale)` (both header and empty state), `formatDayHeading(group.date, locale)`, `formatMoney(t.amount, space.currency, locale)` (both branches).
- ReportsPage: `usePeriod` label needs the locale — change `usePeriod()` to `usePeriod(locale?: string)` and use it in `formatMonth(month, locale)` / `formatWeekRange(week, locale)`. But the hook runs before the space guard; call it as `usePeriod()` and compute the label in the component instead: move `label` out of the hook — simplest is to have the hook return `{ type, setType, value, step, month, week, year, setMonth, setWeek, setYear }` **untouched** and instead pass locale at the call sites. To keep the change minimal: leave `usePeriod` as is but add an optional `locale` argument used only for `label`:

```tsx
function usePeriod(locale: string = 'en-US') {
  ...
  const label = type === 'month' ? formatMonth(month, locale) : type === 'week' ? formatWeekRange(week, locale) : year
  ...
}
```

and in `ReportsPage`, since the hook is called before `space` is loaded, call it with the resolved locale when available: `usePeriod(space ? spaceLocale(space) : undefined)`. (Hook order stays stable; only the argument changes between renders.) All `formatMoney(..., space.currency)` calls gain the `locale` third argument.
- RecurringPage: `formatDayHeading(item.next_due_date, locale)`, `formatMoney(item.amount, space.currency, locale)`.

- [ ] **Step 4: Run tests**

Run: `pnpm test --run`
Expected: PASS (existing English-locale assertions still hold because mock spaces have `locale: ''` and jsdom's `navigator.language` is `en-US`).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src
git commit -m "feat(frontend): per-space formatting locale setting wired through budget pages"
```

---

### Task 5: TransactionsPage — month summary strip + day subtotals

**Files:**
- Modify: `frontend/src/features/budget/TransactionsPage.tsx`
- Test: `frontend/src/features/budget/__tests__/TransactionsPage.test.tsx` (append)

**Interfaces:**
- Consumes: `locale` const from Task 4, `formatMoney` from `@/lib/money`.
- Produces: `data-testid="month-summary"` element (used by its own tests only).

- [ ] **Step 1: Write the failing tests**

Append to `TransactionsPage.test.tsx` (mock data: income 2400.00 on May 12; expenses 84.20 + 32.50 = 116.70 on May 14):

```tsx
  it('shows the month summary strip with income, spent and net', async () => {
    /** The strip totals the fetched transactions: income green, net signed. */
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    const strip = screen.getByTestId('month-summary')
    expect(strip).toHaveTextContent('Income +$2,400.00')
    expect(strip).toHaveTextContent('Spent $116.70')
    expect(strip).toHaveTextContent('Net +$2,283.30')
  })

  it('shows a subtotal in each day heading', async () => {
    /** Expense days show the plain spent amount; income days show green +amount. */
    renderPage()
    const expenseDay = await screen.findByTestId('day-total-2026-05-14')
    expect(expenseDay).toHaveTextContent('$116.70')
    const incomeDay = screen.getByTestId('day-total-2026-05-12')
    expect(incomeDay).toHaveTextContent('+$2,400.00')
    expect(incomeDay).toHaveClass('text-green-600')
  })

  it('hides the summary strip when the month is empty', async () => {
    /** No transactions → no strip, just the empty state. */
    server.use(http.get(`${BASE}/api/budgets/transactions/`, () => HttpResponse.json([])))
    renderPage()
    await screen.findByText(/no transactions in/i)
    expect(screen.queryByTestId('month-summary')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/TransactionsPage.test.tsx`
Expected: new tests FAIL (missing testids).

- [ ] **Step 3: Implement**

In `TransactionsPage.tsx`, after `const groups = groupByDay(transactions)` add:

```tsx
  const isIncomeTx = (t: Transaction) => categoryById.get(t.category)?.is_income ?? false
  const monthIncome = transactions.filter(isIncomeTx).reduce((sum, t) => sum + Number(t.amount), 0)
  const monthExpenses = transactions.filter((t) => !isIncomeTx(t)).reduce((sum, t) => sum + Number(t.amount), 0)
  const monthNet = monthIncome - monthExpenses
```

Render the strip between the header `div` and the loading/empty/list block, only when there is data:

```tsx
      {!isLoading && groups.length > 0 && (
        <p className="text-sm" data-testid="month-summary">
          <span className="text-green-600 dark:text-green-400">
            Income +{formatMoney(monthIncome, space.currency, locale)}
          </span>
          <span className="text-muted-foreground"> · Spent {formatMoney(monthExpenses, space.currency, locale)} · Net </span>
          <span className={cn('font-semibold', monthNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
            {monthNet >= 0 ? '+' : ''}
            {formatMoney(monthNet, space.currency, locale)}
          </span>
        </p>
      )}
```

Replace the day-heading `<p>` with a flex row carrying the day net (income − expenses; positive → green `+X`, otherwise plain absolute spent):

```tsx
            <div key={group.date}>
              {(() => {
                const dayNet = group.items.reduce(
                  (sum, t) => sum + (isIncomeTx(t) ? Number(t.amount) : -Number(t.amount)),
                  0
                )
                return (
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    <span>{formatDayHeading(group.date, locale)}</span>
                    <span
                      data-testid={`day-total-${group.date}`}
                      className={cn(dayNet > 0 && 'text-green-600 dark:text-green-400')}
                    >
                      {dayNet > 0
                        ? `+${formatMoney(dayNet, space.currency, locale)}`
                        : formatMoney(-dayNet, space.currency, locale)}
                    </span>
                  </div>
                )
              })()}
              <Card>
              ...
```

(If the IIFE reads awkwardly, extract a small `DayHeading` component in the same file — either is fine; keep the testid.)

- [ ] **Step 4: Run tests**

Run: `pnpm test --run src/features/budget/__tests__/TransactionsPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget
git commit -m "feat(frontend): month summary strip and day subtotals on transactions"
```

---

### Task 6: Today button on Transactions and Reports

**Files:**
- Modify: `frontend/src/features/budget/TransactionsPage.tsx`, `frontend/src/features/budget/ReportsPage.tsx`
- Test: `frontend/src/features/budget/__tests__/TransactionsPage.test.tsx`, `frontend/src/features/budget/__tests__/ReportsPage.test.tsx` (append)

**Interfaces:**
- Consumes: `currentMonth()`, `currentWeekStart()` from `@/lib/dates`.
- Produces: `usePeriod` (ReportsPage-internal) additionally returns `{ isCurrent: boolean; resetToToday: () => void }`.

- [ ] **Step 1: Write the failing tests**

Append to `TransactionsPage.test.tsx`:

```tsx
  it('shows a Today button only when off the current month', async () => {
    /** Hidden on the current month; appears after stepping back; clicking returns to now. */
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await userEvent.click(await screen.findByRole('button', { name: /today/i }))
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
  })
```

Append to `ReportsPage.test.tsx` (reuse its render helper):

```tsx
  it('shows a Today button only when off the current period', async () => {
    /** Hidden initially; appears after stepping back; clicking resets the period. */
    renderPage()
    await screen.findByText(/🛒 Groceries/)
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /previous period/i }))
    await userEvent.click(await screen.findByRole('button', { name: /today/i }))
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget`
Expected: new tests FAIL (button never found after stepping).

- [ ] **Step 3: Implement**

`TransactionsPage.tsx` — inside the month-switcher `div`, after the next-month button:

```tsx
          {month !== currentMonth() && (
            <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
              Today
            </Button>
          )}
```

`ReportsPage.tsx` — extend `usePeriod` (keep the existing body, add before the return):

```tsx
  const isCurrent =
    type === 'month'
      ? month === currentMonth()
      : type === 'week'
        ? week === currentWeekStart()
        : year === String(new Date().getFullYear())

  const resetToToday = () => {
    if (type === 'month') setMonth(currentMonth())
    else if (type === 'week') setWeek(currentWeekStart())
    else setYear(String(new Date().getFullYear()))
  }

  return { type, setType, value, label, step, isCurrent, resetToToday }
```

In the component, destructure the two new values and render after the next-period button:

```tsx
          {!isCurrent && (
            <Button variant="ghost" size="sm" onClick={resetToToday}>
              Today
            </Button>
          )}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test --run src/features/budget`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget
git commit -m "feat(frontend): conditional Today button on transactions and reports"
```

---

### Task 7: ReportsPage — chart sort, swatches, tooltip, 12 colors, Other slice, responsive cards

**Files:**
- Modify: `frontend/src/features/budget/ReportsPage.tsx`
- Test: `frontend/src/features/budget/__tests__/ReportsPage.test.tsx` (append)

**Interfaces:**
- Consumes: `locale` const (Task 4), `formatMoney`.
- Produces: `data-testid="legend-row"` on legend rows, `data-testid="legend-swatch"` on swatches.

- [ ] **Step 1: Write the failing tests**

Append to `ReportsPage.test.tsx`:

```tsx
  it('sorts the expense legend by amount descending with color swatches', async () => {
    /** Legend order follows totals (Groceries 84.20 before Dining Out 32.50) and each row has a swatch. */
    renderPage()
    await screen.findByText(/expenses by category/i)
    const rows = screen.getAllByTestId('legend-row')
    expect(rows[0]).toHaveTextContent('Groceries')
    expect(rows[1]).toHaveTextContent('Dining Out')
    const swatches = screen.getAllByTestId('legend-swatch')
    expect(swatches).toHaveLength(rows.length)
    expect(swatches[0]).toHaveStyle({ backgroundColor: '#6366f1' })
  })

  it('groups categories beyond twelve into a gray Other slice', async () => {
    /** With 14 expense categories, legend rows 12+ carry the reserved gray swatch. */
    const manyCategories = Array.from({ length: 14 }, (_, i) => ({
      id: i + 10,
      name: `Cat ${i + 1}`,
      icon: '🔖',
      is_income: false,
      transaction_count: 0,
    }))
    const manyRows = manyCategories.map((c, i) => ({
      category_id: c.id,
      category_name: c.name,
      category_icon: c.icon,
      total: String(1400 - i * 100),
    }))
    server.use(
      http.get(`${BASE}/api/budgets/categories/`, () => HttpResponse.json(manyCategories)),
      http.get(`${BASE}/api/budgets/reports/:reportType/`, () => HttpResponse.json(manyRows))
    )
    renderPage()
    await screen.findByText(/expenses by category/i)
    const swatches = screen.getAllByTestId('legend-swatch')
    expect(swatches).toHaveLength(14)
    expect(swatches[10]).not.toHaveStyle({ backgroundColor: '#9ca3af' })
    expect(swatches[11]).toHaveStyle({ backgroundColor: '#9ca3af' })
    expect(swatches[13]).toHaveStyle({ backgroundColor: '#9ca3af' })
  })

  it('lays the summary cards out as a responsive grid', async () => {
    /** The cards container uses grid-cols-1 sm:grid-cols-3. */
    renderPage()
    await screen.findByText(/expenses by category/i)
    const grid = screen.getByTestId('summary-cards')
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-3')
  })
```

(If `transaction_count` on mock categories predates Task 9, omitting it is also fine — the frontend type change lands in Task 9.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/ReportsPage.test.tsx`
Expected: FAIL (no testids; only 8 colors).

- [ ] **Step 3: Implement**

Replace the palette constants:

```tsx
const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6',
  '#f97316', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#0ea5e9',
]
const OTHER_COLOR = '#9ca3af'
const MAX_SLICES = 12
```

Sort the expense rows (replace the existing `expenseRows` line):

```tsx
  const expenseRows: ReportRow[] = rows
    .filter((r) => !incomeCategoryIds.has(r.category_id))
    .sort((a, b) => Number(b.total) - Number(a.total))
```

Build grouped chart data (replace the `chartData` line):

```tsx
  const grouped = expenseRows.length > MAX_SLICES
  const allSlices = expenseRows.map((r) => ({ name: `${r.category_icon} ${r.category_name}`, value: Number(r.total) }))
  const chartData = grouped
    ? [
        ...allSlices.slice(0, MAX_SLICES - 1),
        { name: 'Other', value: allSlices.slice(MAX_SLICES - 1).reduce((sum, s) => sum + s.value, 0) },
      ]
    : allSlices
  const sliceColor = (i: number) => (grouped && i === MAX_SLICES - 1 ? OTHER_COLOR : CHART_COLORS[i])
  const legendColor = (i: number) => (grouped && i >= MAX_SLICES - 1 ? OTHER_COLOR : CHART_COLORS[i])
```

Chart: add `Tooltip` to the recharts import; percent is derived from `expenseTotal`:

```tsx
                <PieChart width={220} height={220}>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={sliceColor(i)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${formatMoney(value, space.currency, locale)} (${expenseTotal > 0 ? Math.round((value / expenseTotal) * 100) : 0}%)`,
                      name,
                    ]}
                  />
                </PieChart>
```

Legend rows (replace the expense list rows):

```tsx
                  {expenseRows.map((r, i) => (
                    <div key={r.category_id} data-testid="legend-row" className="flex items-center justify-between py-1 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          data-testid="legend-swatch"
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: legendColor(i) }}
                        />
                        {r.category_icon} {r.category_name}
                      </span>
                      <span className="font-semibold">
                        {formatMoney(r.total, space.currency, locale)}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {expenseTotal > 0 ? Math.round((Number(r.total) / expenseTotal) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))}
```

Summary cards container and card (replace `<div className="flex gap-3">` and `SummaryCard`):

```tsx
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="summary-cards">
```

```tsx
function SummaryCard({ title, value, className }: { title: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4 sm:flex-col sm:justify-center sm:text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
        <p className={cn('text-lg font-bold sm:mt-1', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test --run src/features/budget/__tests__/ReportsPage.test.tsx`
Expected: PASS (existing tests too — legend text content unchanged).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget
git commit -m "feat(frontend): report chart legend swatches, sorting, tooltip, responsive cards"
```

---

### Task 8: Dialogs — comma-tolerant amounts + currency symbol label; RecurringDialog takes `space`

**Files:**
- Modify: `frontend/src/features/budget/TransactionDialog.tsx`, `RecurringDialog.tsx`, `RecurringPage.tsx`
- Test: `frontend/src/features/budget/__tests__/TransactionDialog.test.tsx` (append)

**Interfaces:**
- Consumes: `currencySymbol` from `@/lib/money`, `spaceLocale` from `@/lib/locale` (Task 3).
- Produces: `RecurringDialog` prop change: `spaceId: number` → `space: Space` (import `type Space` from `@/hooks/useSpaces`). `RecurringPage` passes `space={space}`.

- [ ] **Step 1: Write the failing tests**

Append to `TransactionDialog.test.tsx` (reuse its render helper; it renders the dialog with the mock space, currency USD):

```tsx
  it('accepts a comma as the decimal separator and submits a dot', async () => {
    /** Typing 12,50 passes validation and the payload carries amount "12.50". */
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post(`${BASE}/api/budgets/transactions/`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json({ id: 99, ...body }, { status: 201 })
      })
    )
    renderDialog()
    await userEvent.type(screen.getByLabelText(/amount/i), '12,50')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(bodies[0]).toMatchObject({ amount: '12.50' }))
  })

  it('rejects malformed amounts with the example message', async () => {
    /** "12,5,0" fails validation with the e.g. 12.50 hint. */
    renderDialog()
    await userEvent.type(screen.getByLabelText(/amount/i), '12,5,0')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Enter a positive amount, e.g. 12.50')).toBeInTheDocument()
  })

  it('shows the space currency symbol in the amount label', async () => {
    /** The label reads "Amount ($)" for a USD space. */
    renderDialog()
    expect(screen.getByText('Amount ($)')).toBeInTheDocument()
  })
```

(Adapt `renderDialog` to whatever the existing helper in that file is named; if the helper opens in edit mode by default, use its add-mode variant.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget/__tests__/TransactionDialog.test.tsx`
Expected: FAIL (regex rejects comma; label is plain "Amount").

- [ ] **Step 3: Implement**

In **both** `TransactionDialog.tsx` and `RecurringDialog.tsx`:

- Schema amount line:

```ts
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Enter a positive amount, e.g. 12.50'),
```

- In `onSubmit`, normalize when building the payload:

```ts
      amount: data.amount.replace(',', '.'),
```

- Amount label:

```tsx
            <Label htmlFor="tx-amount">Amount ({currencySymbol(space.currency, spaceLocale(space))})</Label>
```

(`rec-amount` id in RecurringDialog.) Add imports: `import { currencySymbol } from '@/lib/money'` and `import { spaceLocale } from '@/lib/locale'`.

`RecurringDialog.tsx` prop change:

```tsx
import type { Space } from '@/hooks/useSpaces'

interface Props {
  open: boolean
  recurring: RecurringTransaction | null
  space: Space
  categories: Category[]
  onClose: () => void
}
```

Inside the component replace every `spaceId` use with `space.id` (the three mutation hooks), and pass the locale to the next-due line: `formatDayHeading(recurring.next_due_date, spaceLocale(space))`.

`RecurringPage.tsx`: change `<RecurringDialog ... spaceId={space.id} ...>` to `space={space}`.

- [ ] **Step 4: Run tests**

Run: `pnpm test --run src/features/budget`
Expected: PASS (RecurringPage tests still pass — dialog receives the space object).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src/features/budget
git commit -m "feat(frontend): comma-tolerant amounts and currency symbol in dialogs"
```

---

### Task 9: Small fixes — frequency labels, Cancel buttons, category counts

**Files:**
- Modify: `frontend/src/features/budget/RecurringPage.tsx` (frequency label)
- Modify: `frontend/src/features/budget/CategoriesPage.tsx` (Cancel + count), `TransactionDialog.tsx`, `RecurringDialog.tsx` (Cancel)
- Modify: `frontend/src/hooks/useBudget.ts` (`Category` type), `frontend/src/mocks/handlers.ts` (`mockCategories`)
- Test: `frontend/src/features/budget/__tests__/RecurringPage.test.tsx`, `CategoriesPage.test.tsx` (append)

**Interfaces:**
- Consumes: backend `transaction_count` field (Task 2).
- Produces: `Category.transaction_count: number` on the frontend type.

- [ ] **Step 1: Write the failing tests**

Append to `RecurringPage.test.tsx`:

```tsx
  it('renders the frequency capitalized', async () => {
    /** "monthly" from the API renders as "Monthly". */
    renderPage()
    expect(await screen.findByText(/Monthly ·/)).toBeInTheDocument()
  })
```

Append to `CategoriesPage.test.tsx`:

```tsx
  it('shows a transaction count on categories that have transactions', async () => {
    /** Groceries (2 transactions) shows the hint; zero-count categories show none. */
    renderPage()
    expect(await screen.findByText('2 transactions')).toBeInTheDocument()
    expect(screen.queryByText('0 transactions')).not.toBeInTheDocument()
  })

  it('uses Cancel to back out of a delete confirmation', async () => {
    /** The inline confirmation offers Confirm Delete and Cancel. */
    renderPage()
    await userEvent.click(await screen.findByLabelText(/delete Groceries/i))
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('button', { name: /confirm delete/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run src/features/budget`
Expected: new tests FAIL (lowercase frequency, "Keep" label, no counts).

- [ ] **Step 3: Implement**

`frontend/src/hooks/useBudget.ts` — `Category` interface gains:

```ts
  transaction_count: number
```

`frontend/src/mocks/handlers.ts` — `mockCategories` becomes:

```ts
export const mockCategories = [
  { id: 1, name: 'Groceries', icon: '🛒', is_income: false, transaction_count: 2 },
  { id: 2, name: 'Dining Out', icon: '🍽️', is_income: false, transaction_count: 0 },
  { id: 3, name: 'Salary', icon: '💰', is_income: true, transaction_count: 0 },
]
```

(The category POST/PATCH mock handlers spread the request body; add `transaction_count: 0` into those responses so they satisfy the type.)

`RecurringPage.tsx` — module level:

```tsx
const FREQUENCY_LABELS: Record<RecurringTransaction['frequency'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
```

and in the row: `{FREQUENCY_LABELS[item.frequency]} · ...` instead of `{item.frequency} · ...`.

`CategoriesPage.tsx` — in `CategoryRow`, replace the name `<p>` with:

```tsx
      <div className="flex-1">
        <p className="text-sm font-medium">
          {category.icon} {category.name}
        </p>
        {category.transaction_count > 0 && (
          <p className="text-xs text-muted-foreground">
            {category.transaction_count} transaction{category.transaction_count === 1 ? '' : 's'}
          </p>
        )}
      </div>
```

Rename the confirmation's secondary button in **three** places — `CategoryRow` (CategoriesPage), `TransactionDialog`, `RecurringDialog`: the button labeled `Keep` becomes `Cancel` (attributes unchanged). In the two dialogs the footer already has a "Cancel" close button — that one keeps its label; only the confirmation's "Keep" changes, so while confirming, the footer shows `Confirm Delete` / `Cancel` on the left and the form's `Cancel` / `Save` on the right. That matches the DangerZone pattern on SpacesPage.

- [ ] **Step 4: Run the full frontend suite**

Run: `pnpm test --run`
Expected: PASS (any test asserting the "Keep" label must be updated to "Cancel" — search `__tests__` for `Keep`).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format
git add src
git commit -m "fix(frontend): frequency labels, Cancel confirmations, category transaction counts"
```

---

### Task 10: Final verification + roadmap update

**Files:**
- Modify: `docs/ROADMAP.md` (add this polish pass to the phase history)

- [ ] **Step 1: Run both full suites**

```bash
cd backend && uv run pytest
cd ../frontend && pnpm lint && pnpm format:check && pnpm test --run
```

Expected: all pass, zero lint warnings.

- [ ] **Step 2: Update the roadmap**

Add a line to the completed-work section of `docs/ROADMAP.md`, dated 2026-07-03: "Budget section UX polish — totals, chart legend, locale setting, comma amounts, Today button (spec: `docs/superpowers/specs/2026-07-03-budget-ux-improvements-design.md`)." Follow the file's existing format.

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: record budget UX polish pass in roadmap"
```
