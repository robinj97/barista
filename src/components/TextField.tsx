import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** A visible label above the field. Without one, give the input an `aria-label`. */
  label?: string
  /** What is wrong with the value. Shown below the field and read out. */
  error?: string | null
  /** `bg` for a field that sits on a soft card. */
  tone?: 'soft' | 'bg'
  /** Numbers in the mono face. */
  mono?: boolean
  /** A shorter field with smaller text, for a search box among other controls. */
  compact?: boolean
  ref?: Ref<HTMLInputElement>
}

const FIELD = 'w-full rounded-full px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent'

/**
 * The app's pill text input. With a `label` it brings its own label and error line, and the
 * caller's `className` (spacing) goes on the block around them; without one it is just the input.
 */
export function TextField({ label, error, tone = 'soft', mono = false, compact = false, className = '', ref, ...rest }: TextFieldProps) {
  const errorId = useId()
  const fill = tone === 'bg' ? 'bg-bg' : 'bg-soft'
  const input = (
    <input
      ref={ref}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={`${FIELD} ${compact ? 'h-11 text-sm' : 'h-12'} ${fill}${mono ? ' num' : ''}${label ? '' : ` ${className}`}`.trim()}
      {...rest}
    />
  )
  if (!label) return input
  return (
    <div className={className || undefined}>
      <label className="block">
        <span className="px-2 text-xs text-muted">{label}</span>
        <span className="mt-1 block">{input}</span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-1 px-2 text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  )
}
