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
    if (result.current.data) {
      expect(result.current.data[0].name).toBe('Groceries')
    }
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
