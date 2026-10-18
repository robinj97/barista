import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { BackLink } from './BackLink'
import { Button } from './Button'
import { buttonClass } from './buttonStyle'
import { ConfirmSheet } from './ConfirmSheet'
import { LoadingNote } from './LoadingNote'
import { SectionHeading } from './SectionHeading'
import { Spec, SpecGrid } from './Spec'

describe('buttonClass and Button', () => {
  it('makes a full-width primary button by default, and varies by variant and size', () => {
    expect(buttonClass()).toContain('bg-ink')
    expect(buttonClass()).toContain('w-full')
    expect(buttonClass()).toContain('h-12')
    expect(buttonClass({ variant: 'quiet', size: 'md' })).toContain('text-muted')
    expect(buttonClass({ variant: 'quiet', size: 'md' })).toContain('h-11')
    expect(buttonClass({ variant: 'soft' })).toContain('bg-soft')
    expect(buttonClass({ block: false })).not.toContain('w-full')
  })

  it('centres a link that looks like a button', () => {
    expect(buttonClass(undefined, true)).toContain('place-items-center')
    expect(buttonClass()).not.toContain('place-items-center')
  })

  it('is a button that does not submit forms by default, and keeps the caller\'s margin and props', async () => {
    const onClick = vi.fn()
    render(<Button className="mt-4" onClick={onClick}>Go</Button>)
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('mt-4', 'bg-ink')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('can be disabled', () => {
    render(<Button disabled>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
  })
})

describe('ConfirmSheet', () => {
  it('says what will happen, confirms, and lets you back out', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmSheet open onOpenChange={onOpenChange} title="Remove it?" confirmLabel="Remove" cancelLabel="Keep" onConfirm={onConfirm}>
        It goes away.
      </ConfirmSheet>,
    )
    expect(await screen.findByRole('heading', { name: 'Remove it?' })).toBeInTheDocument()
    expect(screen.getByText('It goes away.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('offers "Keep it" unless told otherwise', async () => {
    render(<ConfirmSheet open onOpenChange={() => {}} title="Sure?" confirmLabel="Yes" onConfirm={() => {}}>x</ConfirmSheet>)
    expect(await screen.findByRole('button', { name: 'Keep it' })).toBeInTheDocument()
  })
})

describe('small pieces', () => {
  it('LoadingNote is a status that says Loading… unless told otherwise', () => {
    const { rerender } = render(<LoadingNote />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    rerender(<LoadingNote>Checking the invite…</LoadingNote>)
    expect(screen.getByRole('status')).toHaveTextContent('Checking the invite…')
  })

  it('SectionHeading is a heading', () => {
    render(<SectionHeading>Your bag</SectionHeading>)
    expect(screen.getByRole('heading', { name: 'Your bag' })).toBeInTheDocument()
  })

  it('BackLink is a labelled link', () => {
    render(<MemoryRouter><BackLink to="/beans" label="Back to beans" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Back to beans' })).toHaveAttribute('href', '/beans')
  })
})

describe('Spec', () => {
  it('is read-only by default: a label and its value', () => {
    render(<SpecGrid label="Recipe"><Spec label="Coffee" value="20 g" /></SpecGrid>)
    const grid = screen.getByLabelText('Recipe')
    expect(within(grid).getByText('Coffee').nextSibling).toHaveTextContent('20 g')
    expect(within(grid).queryByRole('button')).not.toBeInTheDocument()
  })

  it('is a button that edits when given onEdit, and says when you set it', async () => {
    const onEdit = vi.fn()
    render(<SpecGrid label="Recipe"><Spec label="Water temp" value="91°C" edited onEdit={onEdit} /></SpecGrid>)
    const button = screen.getByRole('button', { name: 'Water temp: 91°C, set by you. Edit' })
    await userEvent.click(button)
    expect(onEdit).toHaveBeenCalledOnce()
  })
})
