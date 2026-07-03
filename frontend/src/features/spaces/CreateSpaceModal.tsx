import { useState } from 'react'
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
import { toast } from 'sonner'
import { useCreateSpace } from '@/hooks/useSpaces'
import { CURRENCIES, defaultCurrencyForLocale } from '@/lib/currencies'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateSpaceModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(() => defaultCurrencyForLocale())
  const createSpace = useCreateSpace()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createSpace.mutate(
      { name: name.trim(), currency },
      {
        onSuccess: () => {
          setName('')
          onClose()
        },
        onError: () => toast.error('Failed to create space. Please try again.'),
      }
    )
  }

  const handleClose = () => {
    setName('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new space</DialogTitle>
          <DialogDescription>Spaces let you share a budget with your household or a group.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="space-name">Space name</Label>
            <Input
              id="space-name"
              placeholder="e.g. Home Budget"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-currency">Currency</Label>
            <NativeSelect id="space-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Guessed from your browser language — change it if it&apos;s wrong.
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || createSpace.isPending} onClick={handleSubmit}>
            {createSpace.isPending ? 'Creating…' : 'Create Space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
