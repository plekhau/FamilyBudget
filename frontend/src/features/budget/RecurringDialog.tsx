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
import {
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
  type Category,
  type RecurringTransaction,
} from '@/hooks/useBudget'
import { formatDayHeading } from '@/lib/dates'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a positive amount'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  start_date: z.string().min(1, 'Start date is required'),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  recurring: RecurringTransaction | null
  spaceId: number
  categories: Category[]
  onClose: () => void
}

export function RecurringDialog({ open, recurring, spaceId, categories, onClose }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const createRecurring = useCreateRecurring(spaceId)
  const updateRecurring = useUpdateRecurring(spaceId)
  const deleteRecurring = useDeleteRecurring(spaceId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      amount: recurring?.amount ?? '',
      category: String(recurring?.category ?? categories.find((c) => !c.is_income)?.id ?? ''),
      description: recurring?.description ?? '',
      frequency: recurring?.frequency ?? 'monthly',
      start_date: recurring?.start_date ?? new Date().toISOString().slice(0, 10),
    },
  })

  const isPending = createRecurring.isPending || updateRecurring.isPending || deleteRecurring.isPending

  const close = () => {
    reset()
    setConfirmingDelete(false)
    onClose()
  }

  const onSubmit = (data: FormData) => {
    const options = {
      onSuccess: () => {
        toast.success(recurring ? 'Recurring transaction updated' : 'Recurring transaction added')
        close()
      },
      onError: () => toast.error('Failed to save. Please try again.'),
    }
    const payload = {
      category: Number(data.category),
      amount: data.amount,
      description: data.description,
      frequency: data.frequency,
      start_date: data.start_date,
    }
    if (recurring) updateRecurring.mutate({ id: recurring.id, ...payload }, options)
    else createRecurring.mutate({ ...payload, next_due_date: data.start_date }, options)
  }

  const handleDelete = () => {
    if (!recurring) return
    deleteRecurring.mutate(recurring.id, {
      onSuccess: () => {
        toast.success('Recurring transaction deleted')
        close()
      },
      onError: () => toast.error('Failed to delete. Please try again.'),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recurring ? 'Edit recurring transaction' : 'Add recurring transaction'}</DialogTitle>
          <DialogDescription>Templates that add real transactions automatically when due.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2" noValidate>
          <div className="space-y-2">
            <Label htmlFor="rec-description">Description</Label>
            <Input id="rec-description" placeholder="e.g. Rent" {...register('description')} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rec-amount">Amount</Label>
              <Input id="rec-amount" inputMode="decimal" placeholder="0.00" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-category">Category</Label>
              <NativeSelect id="rec-category" {...register('category')}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rec-frequency">Frequency</Label>
              <NativeSelect id="rec-frequency" {...register('frequency')}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-start">Start date</Label>
              <Input id="rec-start" type="date" {...register('start_date')} />
              {errors.start_date && <p className="text-sm text-destructive">{errors.start_date.message}</p>}
            </div>
          </div>
          {recurring && (
            <p className="text-xs text-muted-foreground">Next due: {formatDayHeading(recurring.next_due_date)}</p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {recurring ? (
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
