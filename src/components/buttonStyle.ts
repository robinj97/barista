/**
 * The app's pill buttons, in one place. `primary` is the main action on a screen or sheet, `soft` a
 * second one, `accent` a gentle call to action, `quiet` a plain text action (cancel, skip).
 * Margins stay with the caller (`className="mt-4"`).
 */
export type ButtonVariant = 'primary' | 'soft' | 'accent' | 'quiet'
export type ButtonSize = 'md' | 'lg' | 'xl'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink font-medium text-bg transition-transform active:scale-[0.98] disabled:opacity-40',
  soft: 'bg-soft transition-transform active:scale-[0.98]',
  accent: 'bg-accent-soft text-accent transition-transform active:scale-[0.98]',
  quiet: 'text-sm text-muted',
}
const SIZE: Record<ButtonSize, string> = { md: 'h-11', lg: 'h-12', xl: 'h-14' }

export interface ButtonStyle {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Full width (the default); false for a button that sizes to its label. */
  block?: boolean
}

/** The classes of a button. Use it directly on a link that looks like a button. */
export function buttonClass({ variant = 'primary', size = 'lg', block = true }: ButtonStyle = {}, link = false): string {
  return ['rounded-full', SIZE[size], block ? 'w-full' : 'px-6', VARIANT[variant], link ? 'grid place-items-center' : ''].filter(Boolean).join(' ')
}
