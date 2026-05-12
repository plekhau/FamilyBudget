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

  http.get(`${BASE}/api/spaces/`, () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'Home Budget',
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
    const body = (await request.json()) as { name: string }
    return HttpResponse.json(
      {
        id: 2,
        name: body.name,
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
]
