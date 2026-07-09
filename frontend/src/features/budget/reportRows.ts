import type { Category, ReportRow } from '@/hooks/useBudget'

export interface SplitReportRows {
  incomeRows: ReportRow[]
  expenseRows: ReportRow[]
  incomeTotal: number
  expenseTotal: number
  net: number
}

export function splitReportRows(rows: ReportRow[], categories: Category[]): SplitReportRows {
  const incomeCategoryIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id))
  const expenseRows = rows
    .filter((r) => !incomeCategoryIds.has(r.category_id))
    .sort((a, b) => Number(b.total) - Number(a.total))
  const incomeRows = rows.filter((r) => incomeCategoryIds.has(r.category_id))
  const expenseTotal = expenseRows.reduce((sum, r) => sum + Number(r.total), 0)
  const incomeTotal = incomeRows.reduce((sum, r) => sum + Number(r.total), 0)
  return { incomeRows, expenseRows, incomeTotal, expenseTotal, net: incomeTotal - expenseTotal }
}
