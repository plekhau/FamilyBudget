import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateSpace } from '@/hooks/useSpaces'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateSpaceModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const createSpace = useCreateSpace()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createSpace.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName('')
          onClose()
        },
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setName('')
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new space</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="space-name">Space Name</Label>
            <Input
              id="space-name"
              placeholder="e.g. Home Budget"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {createSpace.isError && (
            <p className="text-sm text-destructive">Failed to create the space. Please try again.</p>
          )}
          <Button type="submit" disabled={!name.trim() || createSpace.isPending} className="w-full">
            {createSpace.isPending ? 'Creating…' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
