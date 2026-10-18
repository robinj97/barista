import type { ButtonHTMLAttributes } from 'react'
import { iconButtonClass, type IconButtonStyle } from './iconButtonStyle'

interface IconButtonProps extends IconButtonStyle, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** What it does, for screen readers. An icon has no text, so this is required. */
  label: string
}

/** A round button holding an icon or a symbol. See `iconButtonStyle.ts` for sizes and tones. */
export function IconButton({ label, size, tone, className = '', type = 'button', ...rest }: IconButtonProps) {
  return <button type={type} aria-label={label} className={`${iconButtonClass({ size, tone })} ${className}`.trim()} {...rest} />
}
