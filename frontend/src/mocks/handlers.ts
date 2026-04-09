import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:8000'

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
]
