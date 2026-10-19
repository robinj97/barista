import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyle'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Full width (the default); false for a button that sizes to its label. */
  block?: boolean
}

/** A pill button. See `buttonStyle.ts` for the variants. Margins come from `className`. */
export function Button({ variant, size, block, className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`${buttonClass({ variant, size, block })} ${className}`.trim()} {...rest} />
}
