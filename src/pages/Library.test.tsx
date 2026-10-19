import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { BrewChoices } from '../brew/params'
import { DEFAULT_CHOICES } from '../brew/params'
import type { LockedRecipe } from '../data/types'
import { SEED_BEANS } from '../dev/mockApi'
import { makeBag, renderApp } from '../test/renderApp'

const geisha = makeBag('b-geisha')
const choices: BrewChoices = { ...DEFAULT_CHOICES, bagId: geisha.id }
const recipe: LockedRecipe = {
  id: 'r1', bean: SEED_BEANS.find((b) => b.id === 'b-geisha')!, method: 'v60', name: 'V60', versionId: 'v1',
  snapshot: { choices, recipe: { doseG: 20, waterG: 300, ratio: 15, tempC: 91, grindUm: 700, targetTimeS: 180, pours: [{ atS: 0, toG: 300 }] } },
  rating: 4, lockedAt: '2026-10-10T10:00:00Z', brewCount: 3,
}
const mock = { bags: [geisha], grinderIds: ['turin-df54'], recipes: [recipe] }

describe('Library', () => {
  it('says what it is for when nothing is locked', async () => {
    renderApp('/library', { mock: { bags: [geisha] } })
    expect(await screen.findByText(/switch on "Lock this as my recipe"/)).toBeInTheDocument()
  })

  it('lists your locked recipes with their stars, brews and numbers', async () => {
    renderApp('/library', { mock })
    const list = await screen.findByRole('list', { name: 'Your recipes' })
    const row = within(list).getByRole('listitem')
    expect(row).toHaveTextContent('Tanzania Geisha')
    expect(row).toHaveTextContent('★★★★')
    expect(row).toHaveTextContent('3 brews')
    expect(row).toHaveTextContent('20 g · 300 g · 91°C')
  })

  it('starts a brew from a recipe with its settings filled in', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock })
    await user.click(await screen.findByRole('link', { name: /Brew Tanzania Geisha again/ }))
    expect(await screen.findByRole('heading', { name: 'Tanzania Geisha' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Recipe')).toBeInTheDocument()
  })

  it('archives a recipe after asking, and it leaves the list', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock })
    await user.click(await screen.findByRole('button', { name: /Archive the recipe for Tanzania Geisha/ }))
    expect(await screen.findByText(/Friends will no longer see it/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
  })

  it('keeps the recipe when you change your mind', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock })
    await user.click(await screen.findByRole('button', { name: /Archive the recipe/ }))
    await user.click(await screen.findByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('list', { name: 'Your recipes' })).toBeInTheDocument()
  })
})

describe('Starting from a locked recipe', () => {
  it('a brew for that bean starts from your recipe: the pill says so', async () => {
    renderApp('/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2', { mock })
    expect(await screen.findByRole('button', { name: /Based on your own recipe/ })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Recipe')).getByText('Water temp').nextSibling).toHaveTextContent('91°C')
  })
})

describe('Library: temperature unit', () => {
  it('shows recipes in your unit, not always Celsius', async () => {
    renderApp('/library', { mock: { ...mock, profile: { temp_unit: 'f' } } })
    const list = await screen.findByRole('list', { name: 'Your recipes' })
    expect(within(list).getByRole('listitem')).toHaveTextContent('196°F')
  })
})
