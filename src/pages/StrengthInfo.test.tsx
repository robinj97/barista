import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeBag, renderApp } from '../test/renderApp'

describe('Strength info', () => {
  it('explains what Light, Medium and Strong change, with the pour counts the engine uses', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [makeBag('b-geisha')] } })
    await user.click(await screen.findByRole('button', { name: 'About strength' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText(/Strength is the number of pours/)).toBeInTheDocument()
    expect(within(sheet).getByText('4 pours in all')).toBeInTheDocument()
    expect(within(sheet).getByText('5 pours in all')).toBeInTheDocument()
    expect(within(sheet).getByText('6 pours in all')).toBeInTheDocument()
    expect(within(sheet).getByText(/The ratio stays 1:15/)).toBeInTheDocument()
    expect(within(sheet).getByText(/not something we've measured/)).toBeInTheDocument()
  })

  it('matches the pours the recipe really has for each strength', async () => {
    const user = userEvent.setup()
    renderApp('/brew/recipe?bag=bag-b-geisha&balance=0&strength=strong&cups=2', { mock: { bags: [makeBag('b-geisha')] } })
    await user.click(await screen.findByRole('radio', { name: 'Pours' }))
    const rows = within(await screen.findByRole('region', { name: 'Pours' })).getAllByRole('listitem')
    expect(rows).toHaveLength(6)
  })
})
