import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('is a pill-shaped text input that passes its props through', async () => {
    const onChange = vi.fn()
    render(<TextField aria-label="Name" placeholder="Your name" inputMode="numeric" value="" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveClass('rounded-full', 'bg-soft', 'h-12', 'w-full')
    expect(input).toHaveAttribute('placeholder', 'Your name')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    await userEvent.type(input, 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows its label above and is found by it', () => {
    render(<TextField label="Roasted" defaultValue="" />)
    expect(screen.getByLabelText('Roasted')).toBeInTheDocument()
    expect(screen.getByText('Roasted')).toHaveClass('text-xs', 'text-muted')
  })

  it('says what is wrong, below the field and to screen readers', () => {
    render(<TextField label="Roasted" error="Use the form dd/mm/yyyy" defaultValue="" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Use the form dd/mm/yyyy')
    expect(screen.getByLabelText('Roasted')).toBeInvalid()
  })

  it('is not marked invalid when there is nothing wrong', () => {
    render(<TextField label="Roasted" error={null} defaultValue="" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Roasted')).toBeValid()
  })

  it('can sit on a soft card: the field takes the page colour instead', () => {
    render(<TextField aria-label="More" tone="bg" />)
    expect(screen.getByRole('textbox', { name: 'More' })).toHaveClass('bg-bg')
    expect(screen.getByRole('textbox', { name: 'More' })).not.toHaveClass('bg-soft')
  })

  it("keeps the caller's spacing, and a ref to focus it", () => {
    const ref = createRef<HTMLInputElement>()
    render(<TextField aria-label="Search" className="mt-3" ref={ref} />)
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveClass('mt-3', 'rounded-full')
    ref.current?.focus()
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()
  })

  it('has a compact size for a search box among other controls', () => {
    render(<TextField aria-label="Search" compact />)
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveClass('h-11', 'text-sm')
    expect(screen.getByRole('textbox', { name: 'Search' })).not.toHaveClass('h-12')
  })

  it('can show numbers in the mono face', () => {
    render(<TextField aria-label="Grams" mono />)
    expect(screen.getByRole('textbox', { name: 'Grams' })).toHaveClass('num')
    render(<TextField aria-label="Plain" />)
    expect(screen.getByRole('textbox', { name: 'Plain' })).not.toHaveClass('num')
  })

  it('can be read-only, like a link to copy', () => {
    render(<TextField aria-label="Link" readOnly value="https://x" />)
    expect(screen.getByRole('textbox', { name: 'Link' })).toHaveAttribute('readonly')
  })

  it('puts the spacing on the whole block when it has a label, so the label, field and error move together', () => {
    const { container } = render(<TextField label="Roaster" error="Enter a roaster" className="mt-4" defaultValue="" />)
    expect(container.firstElementChild).toHaveClass('mt-4')
    expect(screen.getByLabelText('Roaster')).not.toHaveClass('mt-4')
  })

  it('ties the error to the field for screen readers', () => {
    render(<TextField label="Roaster" error="Enter a roaster" defaultValue="" />)
    const input = screen.getByLabelText('Roaster')
    expect(input).toHaveAccessibleDescription('Enter a roaster')
  })
})
