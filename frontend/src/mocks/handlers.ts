import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:8000'

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

export const handlers = [
  http.post(`${BASE}/api/auth/token/`, () =>
    HttpResponse.json({
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    })
  ),

  http.post(`${BASE}/api/auth/register/`, () =>
    HttpResponse.json(
      { id: 1, email: 'test@example.com', display_name: 'Test User', created_at: '2026-04-08T00:00:00Z' },
      { status: 201 }
    )
  ),

  http.get(`${BASE}/api/auth/me/`, () =>
    HttpResponse.json({ id: 1, email: 'test@example.com', display_name: 'Test User' })
  ),

  http.patch(`${BASE}/api/auth/me/`, async ({ request }) => {
    const body = (await request.json()) as { display_name?: string }
    return HttpResponse.json({
      id: 1,
      email: 'test@example.com',
      display_name: body.display_name ?? 'Test User',
    })
  }),

  http.get(`${BASE}/api/spaces/`, () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'Home Budget',
        currency: 'USD',
        locale: '',
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
      },
    ])
  ),

  http.post(`${BASE}/api/spaces/`, async ({ request }) => {
    const body = (await request.json()) as { name: string; currency?: string; locale?: string }
    return HttpResponse.json(
      {
        id: 2,
        name: body.name,
        currency: body.currency ?? 'USD',
        locale: body.locale ?? '',
        created_at: '2026-01-01T00:00:00Z',
        members: [
          {
            id: 3,
            user: { id: 1, email: 'test@example.com', display_name: 'Test User' },
            role: 'owner',
            joined_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
      { status: 201 }
    )
  }),

  http.delete(`${BASE}/api/spaces/:id/`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/api/spaces/:spaceId/invites/`, () =>
    HttpResponse.json(
      {
        id: 1,
        space: 1,
        token: 'test-invite-token-uuid',
        status: 'pending',
        expires_at: '2026-01-08T00:00:00Z',
      },
      { status: 201 }
    )
  ),

  http.post(`${BASE}/api/spaces/invites/accept/`, () => HttpResponse.json({ detail: 'Joined space successfully.' })),

  http.patch(`${BASE}/api/spaces/:id/`, async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; currency?: string; locale?: string }
    return HttpResponse.json({
      id: Number(params.id),
      name: body.name ?? 'Home Budget',
      currency: body.currency ?? 'USD',
      locale: body.locale ?? '',
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
]
