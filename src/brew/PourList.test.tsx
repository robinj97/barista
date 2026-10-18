import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BeanHeader } from '../beans/BeanHeader'
import { PourList } from './PourList'

const pours = [{ atS: 0, toG: 60 }, { atS: 45, toG: 120 }, { atS: 85, toG: 180 }]

describe('PourList', () => {
  it('lists each pour with its start and the running total', () => {
    render(<PourList pours={pours} label="Pours" />)
    const rows = within(screen.getByRole('list', { name: 'Pours' })).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('0:45')
    expect(rows[1]).toHaveTextContent('120 g')
    expect(rows[1]).not.toHaveTextContent('+60 g')
  })

  it('can show how much each pour adds', () => {
    render(<PourList pours={pours} amounts />)
    expect(screen.getAllByRole('listitem')[2]).toHaveTextContent('+60 g')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('+60 g')
  })

  it('ticks done pours and highlights the active one', () => {
    render(<PourList pours={pours} progress={(i) => (i === 0 ? 'done' : i === 1 ? 'active' : 'upcoming')} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('✓')
    expect(rows[1]).toHaveAttribute('aria-current', 'step')
    expect(rows[2]).not.toHaveAttribute('aria-current')
    expect(rows[2]).toHaveTextContent('3')
  })
})

describe('BeanHeader', () => {
  it('shows the title and the line under it, with a back arrow when given one', () => {
    render(<BeanHeader beanId="b-geisha" title="Tanzania Geisha" subtitle="Placeholder Roasters" back={<a href="/beans">back</a>} />)
    expect(screen.getByRole('heading', { name: 'Tanzania Geisha' })).toBeInTheDocument()
    expect(screen.getByText('Placeholder Roasters')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'back' })).toBeInTheDocument()
  })
})
