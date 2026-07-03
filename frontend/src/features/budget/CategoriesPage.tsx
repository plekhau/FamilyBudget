import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories, useDeleteCategory, type Category } from '@/hooks/useBudget'
import { useSelectedSpace } from './useSelectedSpace'
import { NoSpaceState } from './NoSpaceState'
import { CategoryDialog } from './CategoryDialog'

function CategoryRow({
  category,
  onEdit,
  onDelete,
  deleting,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex items-center gap-3 py-2.5">
      <p className="flex-1 text-sm font-medium">
        {category.icon} {category.name}
      </p>
      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={() => {
              onDelete()
              setConfirming(false)
            }}
          >
            Confirm Delete
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <>
          <Button variant="ghost" size="icon" aria-label={`edit ${category.name}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`delete ${category.name}`}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

function CategorySection({
  title,
  categories,
  onEdit,
  onDelete,
  deleting,
}: {
  title: string
  categories: Category[]
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  deleting: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {categories.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onEdit={() => onEdit(c)}
              onDelete={() => onDelete(c)}
              deleting={deleting}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function CategoriesPage() {
  const { space, isLoading: spaceLoading } = useSelectedSpace()
  const { data: categories = [], isLoading } = useCategories(space?.id ?? null)
  const deleteCategory = useDeleteCategory(space?.id ?? 0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  if (spaceLoading || isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }
  if (!space) return <NoSpaceState />

  const handleDelete = (category: Category) => {
    deleteCategory.mutate(category.id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: (error) => {
        const detail =
          isAxiosError(error) && error.response?.status === 409
            ? (error.response.data as { detail: string }).detail
            : 'Failed to delete category. Please try again.'
        toast.error(detail)
      },
    })
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Categories</h1>
            <p className="text-sm text-muted-foreground">Organize spending and income in {space.name}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add category
          </Button>
        </div>

        <CategorySection
          title="Expenses"
          categories={categories.filter((c) => !c.is_income)}
          onEdit={setEditing}
          onDelete={handleDelete}
          deleting={deleteCategory.isPending}
        />
        <CategorySection
          title="Income"
          categories={categories.filter((c) => c.is_income)}
          onEdit={setEditing}
          onDelete={handleDelete}
          deleting={deleteCategory.isPending}
        />

        <CategoryDialog
          open={dialogOpen || editing !== null}
          category={editing}
          spaceId={space.id}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
        />
      </div>
    </>
  )
}
