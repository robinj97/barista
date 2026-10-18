import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHOICES } from '../brew/params'
import type { FriendRecipe, LockedRecipe } from '../data/types'
import { SEED_BEANS } from '../dev/mockApi'
import { makeBag, renderApp } from '../test/renderApp'

const geisha = makeBag('b-geisha')
const sam = { id: 'friend-1', name: 'Sam', avatarUrl: null }
const friendRecipe = (extra: Partial<FriendRecipe> = {}): FriendRecipe => ({
  id: 'fr1',
  friend: sam,
  bean: SEED_BEANS.find((b) => b.id === 'b-geisha')!,
  method: 'v60',
  name: 'V60',
  lockedAt: '2026-10-12T10:00:00Z',
  snapshot: {
    choices: { ...DEFAULT_CHOICES, bagId: 'their-bag', grinderId: 'their-grinder', filterId: 'their-filter' },
    recipe: { doseG: 18, waterG: 270, ratio: 15, tempC: 91, grindUm: 700, targetTimeS: 170, pours: [{ atS: 0, toG: 54 }, { atS: 45, toG: 108 }, { atS: 85, toG: 270 }] },
  },
  ...extra,
})
const mock = { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'], friends: [{ id: 'friend-1', name: 'Sam', avatarUrl: null, since: '2026-10-01T10:00:00Z' }], friendRecipeList: [friendRecipe()] }

describe('Library: Friends', () => {
  it('has a Mine / Friends switch, starting on yours', async () => {
    renderApp('/library', { mock })
    expect(await screen.findByRole('radio', { name: 'Mine' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Friends' })).not.toBeChecked()
  })

  it("lists what your friends locked, with their numbers in your grinder's units", async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock })
    await user.click(await screen.findByRole('radio', { name: 'Friends' }))
    const list = await screen.findByRole('list', { name: "Friends' recipes" })
    const row = within(list).getByRole('listitem')
    expect(row).toHaveTextContent('Tanzania Geisha')
    expect(row).toHaveTextContent('Sam')
    expect(row).toHaveTextContent('18 g · 270 g · 91°C')
    await waitFor(() => expect(row).toHaveTextContent('dial'))
  })

  it('opens the recipe in full when you tap it', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock })
    await user.click(await screen.findByRole('radio', { name: 'Friends' }))
    await user.click(await screen.findByRole('button', { name: /Tanzania Geisha from Sam: see the recipe/ }))
    const specs = await screen.findByLabelText('Their recipe')
    expect(within(specs).getByText('Coffee').nextSibling).toHaveTextContent('18 g')
    expect(within(specs).getByText('Water').nextSibling).toHaveTextContent('270 g')
    expect(within(specs).getByText('Ratio').nextSibling).toHaveTextContent('1:15')
    expect(within(screen.getByRole('list', { name: 'Their pours' })).getAllByRole('listitem')).toHaveLength(3)
  })

  it('starts a brew from their numbers, on your gear', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock })
    await user.click(await screen.findByRole('radio', { name: 'Friends' }))
    await user.click(await screen.findByRole('button', { name: /Tanzania Geisha from Sam/ }))
    await user.click(await screen.findByRole('link', { name: 'Brew this' }))
    const specs = await screen.findByLabelText('Recipe')
    expect(within(specs).getByText('Coffee').nextSibling).toHaveTextContent('18 g')
    expect(within(specs).getByText('Water').nextSibling).toHaveTextContent('270 g')
    expect(within(specs).getByText('Water temp').nextSibling).toHaveTextContent('91°C')
    expect(within(specs).getByText('Filter').nextSibling).toHaveTextContent('T-90')
  })

  it('still shows a recipe for a bean you do not have, and says what to do', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock: { ...mock, bags: [] } })
    await user.click(await screen.findByRole('radio', { name: 'Friends' }))
    const row = within(await screen.findByRole('list', { name: "Friends' recipes" })).getByRole('listitem')
    expect(row).toHaveTextContent('Add this bean to brew it')
    await user.click(within(row).getByRole('button'))
    expect(await screen.findByText(/You don't have this bean yet/)).toBeInTheDocument()
    expect(screen.getByLabelText('Their recipe')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Brew this' })).not.toBeInTheDocument()
  })

  it('points you to Friends when you have none, and says so when they have not locked anything', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock: { bags: [geisha] } })
    await user.click(await screen.findByRole('radio', { name: 'Friends' }))
    expect(await screen.findByRole('link', { name: 'Invite someone' })).toHaveAttribute('href', '/friends')
  })

  it('says so when friends have not locked anything yet', async () => {
    const user = userEvent.setup()
    renderApp('/library', { mock: { bags: [geisha], friends: mock.friends } })
    await user.click(await screen.findByRole('radio', { name: 'Friends' }))
    expect(await screen.findByText(/When a friend locks a recipe/)).toBeInTheDocument()
  })
})

describe('Suggestions from a friend', () => {
  const at = '/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2'

  it("start from a friend's recipe for the same bean and name them", async () => {
    renderApp(at, { mock })
    expect(await screen.findByRole('button', { name: /Based on Sam's locked recipe/ })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Recipe')).getByText('Water temp').nextSibling).toHaveTextContent('91°C')
  })

  it('prefer your own locked recipe', async () => {
    const own: LockedRecipe = {
      id: 'r1', beanId: 'b-geisha', method: 'v60', name: 'V60', versionId: 'v1',
      snapshot: { choices: { ...DEFAULT_CHOICES, bagId: geisha.id }, recipe: { doseG: 20, waterG: 300, ratio: 15, tempC: 94, grindUm: 780, targetTimeS: 190, pours: [{ atS: 0, toG: 300 }] } },
      rating: 5, lockedAt: '2026-10-15T08:00:00Z', brewCount: 2,
    }
    renderApp(at, { mock: { ...mock, recipes: [own] } })
    expect(await screen.findByRole('button', { name: /Based on your own recipe/ })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Recipe')).getByText('Water temp').nextSibling).toHaveTextContent('94°C')
  })
})
