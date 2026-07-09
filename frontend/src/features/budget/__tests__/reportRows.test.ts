import { splitReportRows } from '../reportRows'
import type { Category, ReportRow } from '@/hooks/useBudget'

const categories: Category[] = [
  { id: 1, name: 'Groceries', icon: '🛒', is_income: false, transaction_count: 0 },
  { id: 2, name: 'Dining Out', icon: '🍽️', is_income: false, transaction_count: 0 },
  { id: 3, name: 'Salary', icon: '💰', is_income: true, transaction_count: 0 },
]

const rows: ReportRow[] = [
  { category_id: 1, category_name: 'Groceries', category_icon: '🛒', total: '84.20' },
  { category_id: 2, category_name: 'Dining Out', category_icon: '🍽️', total: '132.50' },
  { category_id: 3, category_name: 'Salary', category_icon: '💰', total: '2400.00' },
]

describe('splitReportRows', () => {
  it('splits rows into income and expenses using is_income flags', () => {
    /** Salary lands in incomeRows; Groceries and Dining Out land in expenseRows. */
    const result = splitReportRows(rows, categories)
    expect(result.incomeRows.map((r) => r.category_id)).toEqual([3])
    expect(result.expenseRows.map((r) => r.category_id)).toEqual([2, 1])
  })

  it('sorts expense rows by total descending', () => {
    /** Dining Out (132.50) comes before Groceries (84.20). */
    const result = splitReportRows(rows, categories)
    expect(result.expenseRows[0].total).toBe('132.50')
  })

  it('computes income, expense and net totals', () => {
    /** incomeTotal 2400, expenseTotal 216.70, net 2183.30 (floating-point tolerant). */
    const result = splitReportRows(rows, categories)
    expect(result.incomeTotal).toBe(2400)
    expect(result.expenseTotal).toBeCloseTo(216.7)
    expect(result.net).toBeCloseTo(2183.3)
  })

  it('treats rows with unknown categories as expenses', () => {
    /** A row whose category is not in the list is counted as an expense, matching ReportsPage behavior. */
    const orphan: ReportRow[] = [{ category_id: 99, category_name: 'Ghost', category_icon: '', total: '10.00' }]
    const result = splitReportRows(orphan, categories)
    expect(result.expenseRows).toHaveLength(1)
    expect(result.incomeRows).toHaveLength(0)
  })
})
