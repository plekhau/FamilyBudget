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
    if (!transaction) return
    deleteTransaction.mutate(transaction.id, {
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
