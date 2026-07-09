import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Category {
  id: number
  name: string
  icon: string
  is_income: boolean
  transaction_count: number
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
  // Creating a recurring entry can immediately materialize due transactions on the backend
  const invalidate = useInvalidateBudget(spaceId, ['recurring', 'transactions', 'report'])
  return useMutation({
    mutationFn: (data: RecurringPayload) =>
      api
        .post<RecurringTransaction>('/api/budgets/recurring-transactions/', { ...data, space_id: spaceId })
        .then((r) => r.data),
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
      api
        .get<ReportRow[]>(`/api/budgets/reports/${path}/?space_id=${spaceId}&${param}=${periodValue}`)
        .then((r) => r.data),
  })
}
