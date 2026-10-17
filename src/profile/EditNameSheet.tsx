import { useState, type FormEvent } from 'react'
import { Sheet } from '../components/Sheet'

interface EditNameSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  onSave: (name: string) => void
}

export function EditNameSheet({ open, onOpenChange, initialName, onSave }: EditNameSheetProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Enter a name')
    if (trimmed.length > 60) return setError('Keep it to 60 characters')
    onSave(trimmed)
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName(initialName)
          setError(null)
        }
        onOpenChange(next)
      }}
      title="Display name"
    >
      <form onSubmit={submit} className="space-y-3 px-3 pb-2">
        <label className="block">
          <span className="sr-only">Display name</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            autoComplete="name"
            enterKeyHint="done"
            className="h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        {error && (
          <p role="alert" className="px-2 text-sm text-accent">
            {error}
          </p>
        )}
        <button type="submit" className="h-12 w-full rounded-full bg-ink font-medium text-bg active:scale-[0.98]">
          Save
        </button>
      </form>
    </Sheet>
  )
}
