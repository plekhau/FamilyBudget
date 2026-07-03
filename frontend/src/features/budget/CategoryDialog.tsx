import { useForm, useWatch } from 'react-hook-form'
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
import { Switch } from '@/components/ui/switch'
import { useCreateCategory, useUpdateCategory, type Category } from '@/hooks/useBudget'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
  is_income: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  category: Category | null
  spaceId: number
  onClose: () => void
}

export function CategoryDialog({ open, category, spaceId, onClose }: Props) {
  const createCategory = useCreateCategory(spaceId)
  const updateCategory = useUpdateCategory(spaceId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      name: category?.name ?? '',
      icon: category?.icon ?? '📦',
      is_income: category?.is_income ?? false,
    },
  })
  const isIncome = useWatch({ control, name: 'is_income' })
  const isPending = createCategory.isPending || updateCategory.isPending

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (data: FormData) => {
    const options = {
      onSuccess: () => {
        toast.success(category ? 'Category updated' : 'Category added')
        close()
      },
      onError: () => toast.error('Failed to save category. Please try again.'),
    }
    if (category) updateCategory.mutate({ id: category.id, ...data }, options)
    else createCategory.mutate(data, options)
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
          <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
          <DialogDescription>Categories organize this space&apos;s transactions.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2" noValidate>
          <div className="grid grid-cols-[5rem_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-icon">Icon</Label>
              <Input id="cat-icon" maxLength={4} {...register('icon')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" placeholder="e.g. Pets" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="cat-income" checked={isIncome} onCheckedChange={(v) => setValue('is_income', v)} />
            <Label htmlFor="cat-income">This is income</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
