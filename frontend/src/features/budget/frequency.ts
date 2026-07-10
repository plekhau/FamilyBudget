import type { RecurringTransaction } from '@/hooks/useBudget'

export const FREQUENCY_LABELS: Record<RecurringTransaction['frequency'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
