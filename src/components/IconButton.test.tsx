import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'
import { iconButtonClass } from './iconButtonStyle'

describe('IconButton', () => {
  it('is a round button named by its label, with the icon inside', async () => {
    const onClick = vi.fn()
    render(<IconButton label="Less coffee" onClick={onClick}>−</IconButton>)
    const button = screen.getByRole('button', { name: 'Less coffee' })
    expect(button).toHaveTextContent('−')
    expect(button).toHaveClass('rounded-full')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('never submits a form by accident', () => {
    render(<IconButton label="More">+</IconButton>)
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('type', 'button')
  })

  it('comes in four sizes', () => {
    const sizes = { sm: 'size-9', md: 'size-10', lg: 'size-11', xl: 'size-12' } as const
    for (const [size, cls] of Object.entries(sizes)) {
      const { unmount } = render(<IconButton label={size} size={size as keyof typeof sizes}>x</IconButton>)
      expect(screen.getByRole('button', { name: size })).toHaveClass(cls)
      unmount()
    }
  })

  it('is medium and soft unless told otherwise, and can sit on a soft card or on nothing', () => {
    const { rerender } = render(<IconButton label="a">x</IconButton>)
    expect(screen.getByRole('button', { name: 'a' })).toHaveClass('size-10', 'bg-soft')
    rerender(<IconButton label="a" tone="bg">x</IconButton>)
    expect(screen.getByRole('button', { name: 'a' })).toHaveClass('bg-bg')
    rerender(<IconButton label="a" tone="plain">x</IconButton>)
    expect(screen.getByRole('button', { name: 'a' })).not.toHaveClass('bg-soft')
    expect(screen.getByRole('button', { name: 'a' })).toHaveClass('text-muted')
  })

  it('can be disabled, and keeps the caller\'s classes', () => {
    render(<IconButton label="Remove" disabled className="ml-2">x</IconButton>)
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('ml-2')
  })
})

describe('iconButtonClass', () => {
  it('gives a link the same look, centred', () => {
    render(
      <MemoryRouter>
        <Link to="/x" aria-label="Back" className={iconButtonClass({ size: 'lg' })}>
          ←
        </Link>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Back' })).toHaveClass('size-11', 'rounded-full', 'bg-soft', 'grid', 'place-items-center')
  })
})
