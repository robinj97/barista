import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

type User = ReturnType<typeof userEvent.setup>

/** Opens the sheet, types a name nobody has, and gets to the new-bean form. */
async function toNewBeanForm(user: User, roaster: string, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Add a bag' }))
  await user.type(await screen.findByLabelText('Search roaster or bean'), 'Zzz Unmatched')
  const group = await screen.findByRole('group', { name: 'Add as a new bean' })
  await user.click(within(group).getByRole('button', { name: 'Bean name' }))
  const nameField = screen.getByLabelText('Name')
  await user.clear(nameField)
  await user.type(nameField, name)
  const roasterField = screen.getByLabelText('Roaster')
  await user.clear(roasterField)
  await user.type(roasterField, roaster)
}

describe('One entry per coffee', () => {
  it('uses the existing bean when the same coffee is entered with a different spelling', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await toNewBeanForm(user, 'Coffea Circulor Roasters', 'elto  arbegona')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/already in the catalogue, so we're using it/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Add to my beans' })).toBeInTheDocument()
    expect(screen.getByText(/Elto Arbegona/)).toBeInTheDocument()
  })

  it('asks when a new bean looks a lot like one that exists, and lets you use it', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await toNewBeanForm(user, 'Coffea Circulor', 'Elto Arbegona Lot 2')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Is it one of these?' })).toBeInTheDocument()
    expect(screen.getByText('Elto Arbegona')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this one' }))
    await user.click(await screen.findByRole('button', { name: 'Add to my beans' }))
    expect(await screen.findByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
  })

  it('still lets you add it as a different bean', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await toNewBeanForm(user, 'Coffea Circulor', 'Elto Arbegona Lot 2')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByRole('button', { name: "It's a different bean" }))
    await user.click(await screen.findByRole('button', { name: 'Add to my beans' }))
    expect(await screen.findByRole('heading', { name: 'Elto Arbegona Lot 2' })).toBeInTheDocument()
  })

  it('goes back to the form with what you typed', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await toNewBeanForm(user, 'Coffea Circulor', 'Elto Arbegona Lot 2')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByRole('button', { name: '← Back' }))
    expect(await screen.findByLabelText('Name')).toHaveValue('Elto Arbegona Lot 2')
  })

  it('goes straight on for a bean that is nothing like the catalogue', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await toNewBeanForm(user, 'Qqq Roasters', 'Something Entirely New')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('button', { name: 'Add to my beans' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Is it one of these?' })).not.toBeInTheDocument()
  })

  it('never makes a second catalogue entry for the same coffee, whatever the spelling', async () => {
    const { api } = renderApp('/beans')
    await api.addBag({ bagId: 'bag-a', newBean: { roaster: 'Coffea Circulor Roasters', name: 'ELTO ARBEGONA', roasterNotes: [] } })
    await api.addBag({ bagId: 'bag-b', newBean: { roaster: 'coffea circulor', name: 'Elto Arbegona', roasterNotes: [] } })
    expect((await api.searchBeans('arbegona')).length).toBe(1)
    const bags = await api.listMyBags()
    expect(new Set(bags.map((b) => b.bean.id)).size).toBe(1)
  })
})
