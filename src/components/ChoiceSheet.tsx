import { useState } from 'react'
import { Drawer } from 'vaul'

interface ChoiceSheetProps {
  title: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

/** Choices live in bottom sheets, not new pages. */
export function ChoiceSheet({ title, options, value, onChange }: ChoiceSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger className="flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-soft px-4 text-left">
        <span className="text-muted">{title}</span>
        <span className="font-medium">{value}</span>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-hairline" />
          <Drawer.Title className="px-5 pt-4 pb-2 text-lg font-semibold">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">Choose one option</Drawer.Description>
          <ul className="px-2">
            {options.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left active:bg-soft"
                >
                  <span>{option}</span>
                  {option === value && <span className="text-accent">Selected</span>}
                </button>
              </li>
            ))}
          </ul>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
