import { useState } from 'react'
import { Drawer } from 'vaul'

interface ChoiceSheetProps {
  title: string
  options: string[]
  value: string
  onChange: (value: string) => void
  /** Colour of the trigger: 'soft' on the page, 'bg' when it sits inside a soft card. */
  tone?: 'soft' | 'bg'
}

/** Choices live in bottom sheets, not new pages. */
export function ChoiceSheet({ title, options, value, onChange, tone = 'soft' }: ChoiceSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger className={`flex h-14 w-full items-center justify-between rounded-full px-6 text-left transition-transform active:scale-[0.98] ${tone === 'bg' ? 'bg-bg' : 'bg-soft'}`}>
        <span className="text-muted">{title}</span>
        <span className="font-medium">{value}</span>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-xl rounded-[2rem] bg-bg pb-[max(0.75rem,env(safe-area-inset-bottom))] outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-hairline" />
          <Drawer.Title className="px-6 pt-4 pb-2 text-lg font-medium">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">Choose one option</Drawer.Description>
          <ul className="space-y-1 px-3 pb-2">
            {options.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className={`flex h-12 w-full items-center justify-between rounded-full px-5 text-left transition-colors ${
                    option === value ? 'bg-accent-soft' : 'active:bg-soft'
                  }`}
                >
                  <span>{option}</span>
                  {option === value && <span className="text-sm text-accent">Selected</span>}
                </button>
              </li>
            ))}
          </ul>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
