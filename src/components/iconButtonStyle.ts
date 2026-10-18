/**
 * The round buttons that hold an icon or a symbol: back arrows, steppers (− +), info. `soft` sits on
 * the page, `bg` sits on a soft card, `plain` has no fill. Margins stay with the caller.
 */
export type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl'
export type IconButtonTone = 'soft' | 'bg' | 'plain'

const SIZE: Record<IconButtonSize, string> = { sm: 'size-9', md: 'size-10', lg: 'size-11', xl: 'size-12' }
const TONE: Record<IconButtonTone, string> = {
  soft: 'bg-soft',
  bg: 'bg-bg',
  plain: 'text-muted active:bg-soft',
}

export interface IconButtonStyle {
  size?: IconButtonSize
  tone?: IconButtonTone
}

/** The classes of a round icon button; use it directly on a link that looks like one. */
export function iconButtonClass({ size = 'md', tone = 'soft' }: IconButtonStyle = {}): string {
  return ['grid shrink-0 place-items-center rounded-full transition-transform active:scale-95', SIZE[size], TONE[tone]].join(' ')
}
