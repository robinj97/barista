import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pendingCount } from '../data/outbox'
import { makeBag, renderApp } from '../test/renderApp'

const geisha = makeBag('b-geisha', { createdAt: '2026-10-14T10:00:00Z' })
const at = '/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2'
const mock = { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'] }

/** Start the timer and tick every pour off, which lands on the log screen. */
async function brew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Start brewing' }))
  await user.click(await screen.findByRole('button', { name: 'Start timer' }))
  for (let n = 1; n <= 5; n++) await user.click(await screen.findByRole('button', { name: `Pour ${n} done` }))
  await user.click(screen.getByRole('button', { name: 'Drawdown finished' }))
  await screen.findByRole('heading', { name: 'How did it go?' })
}

describe('Brewing', () => {
  it('starts from the recipe, takes you to the pours and runs the timer', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    expect(await screen.findByRole('button', { name: 'Start brewing' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start brewing' }))
    expect(await screen.findByRole('region', { name: 'Pours' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start timer' }))
    expect(screen.getByRole('timer')).toHaveTextContent('0:0')
    expect(screen.getByText(/Pour 1: up to 60 g/)).toBeInTheDocument()
    // The recipe can no longer be edited while brewing.
    expect(screen.queryByRole('radio', { name: 'Recipe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit pours' })).not.toBeInTheDocument()
  })

  it('ticks pours off in order, then asks for the drawdown', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    await user.click(await screen.findByRole('button', { name: 'Start brewing' }))
    await user.click(await screen.findByRole('button', { name: 'Start timer' }))
    await user.click(screen.getByRole('button', { name: 'Pour 1 done' }))
    expect(within(screen.getByRole('list', { name: 'Pour progress' })).getAllByRole('listitem')[0]).toHaveTextContent('✓')
    expect(screen.getByRole('button', { name: 'Pour 2 done' })).toBeInTheDocument()
    for (let n = 2; n <= 5; n++) await user.click(screen.getByRole('button', { name: `Pour ${n} done` }))
    expect(screen.getByText(/Let it drain/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drawdown finished' })).toBeInTheDocument()
  })

  it('can be cancelled', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    await user.click(await screen.findByRole('button', { name: 'Start brewing' }))
    await user.click(await screen.findByRole('button', { name: 'Start timer' }))
    await user.click(screen.getByRole('button', { name: 'Cancel brew' }))
    await user.click(screen.getByRole('button', { name: 'Yes, cancel this brew' }))
    expect(await screen.findByRole('button', { name: 'Start brewing' })).toBeInTheDocument()
    expect(localStorage.getItem('barista.brew-session')).toBeNull()
  })

  it('picks the timer back up after the app is reopened', async () => {
    localStorage.setItem(
      'barista.brew-session',
      JSON.stringify({ bagId: 'bag-b-geisha', search: at.split('?')[1], asOf: '2026-10-17', startedAt: Date.now() - 41_000, ticksS: [30], finishedS: null }),
    )
    renderApp(at, { mock })
    expect(await screen.findByRole('timer')).toHaveTextContent('0:4')
    expect(screen.getByRole('button', { name: 'Pour 2 done' })).toBeInTheDocument()
  })

  it('offers to finish logging a brew that was never saved', async () => {
    localStorage.setItem(
      'barista.brew-session',
      JSON.stringify({ bagId: 'bag-b-geisha', search: at.split('?')[1], asOf: '2026-10-17', startedAt: Date.now() - 200_000, ticksS: [30, 70, 100, 130, 160], finishedS: 190 }),
    )
    renderApp(at, { mock })
    expect(await screen.findByRole('link', { name: /Finish logging your last brew/ })).toHaveAttribute('href', '/brew/log')
  })
})

describe('Logging', () => {
  it('saves your working recipe and shows it on the bean as where you left off', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    await brew(user)
    await user.click(screen.getByRole('radio', { name: 'Sour' }))
    await user.type(screen.getByLabelText(/Yield in the cup/), '255')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Tanzania Geisha' })).toBeInTheDocument()
    const recipes = await screen.findByRole('region', { name: 'Recipes' })
    const card = await within(recipes).findByRole('link', { name: /Where you left off/ })
    expect(card).toHaveTextContent('20 g · 300 g')
    expect(card).toHaveTextContent('Sour')
    expect(localStorage.getItem('barista.brew-session')).toBeNull()
  })

  it('asks how it compares only when there was a previous brew', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    await brew(user)
    expect(screen.queryByRole('region', { name: 'Compared with last time' })).not.toBeInTheDocument()
  })

  it('asks how it compares with last time when there was one', async () => {
    const user = userEvent.setup()
    renderApp(at, {
      mock: {
        ...mock,
        drafts: [
          {
            beanId: 'b-geisha',
            method: 'v60',
            choices: { bagId: 'bag-b-geisha', balance: 0, strength: 'medium', grinderId: null, filterId: null, cups: 2, edits: {} },
            lastBrew: { brewedAt: '2026-10-16T08:00:00Z', pourTicksS: [], totalTimeS: 170, taste: 'sour', compared: null, yieldG: null, notes: '', firstPourG: 60 },
            updatedAt: '2026-10-16T08:00:00Z',
          },
        ],
      },
    })
    await brew(user)
    const region = screen.getByRole('region', { name: 'Compared with last time' })
    await user.click(within(region).getByRole('radio', { name: 'More acidity' }))
    expect(within(region).getByRole('radio', { name: 'More acidity' })).toBeChecked()
  })

  it('needs a rating to lock a recipe in, and shows it locked on the bean', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    await brew(user)
    expect(screen.queryByRole('radiogroup', { name: 'Rating' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /Lock this as my recipe/ }))
    expect(screen.getByRole('button', { name: 'Lock in and save' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: '4 stars' }))
    await user.click(screen.getByRole('button', { name: 'Lock in and save' }))
    const recipes = await screen.findByRole('region', { name: 'Recipes' })
    expect(await within(recipes).findByRole('link', { name: /Locked · ★★★★/ })).toBeInTheDocument()
  })

  it('refuses a yield that is not a number', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock })
    await brew(user)
    fireEvent.change(screen.getByLabelText(/Yield in the cup/), { target: { value: '-5' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('has nothing to log when no brew was finished', async () => {
    renderApp('/brew/log', { mock })
    expect(await screen.findByRole('heading', { name: 'Nothing to log' })).toBeInTheDocument()
  })

  it('saves on the phone when offline, and sends it when the connection returns', async () => {
    const user = userEvent.setup()
    let offline = true
    renderApp(at, { mock: { ...mock, isOffline: () => offline } })
    await brew(user)
    await user.click(screen.getByRole('radio', { name: 'Good' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Saved on this phone/)).toBeInTheDocument()
    expect(pendingCount()).toBeGreaterThan(0)
    offline = false
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(pendingCount()).toBe(0))
  })
})

describe('Starting from your last recipe', () => {
  it('opens the recipe with the settings you left off with', async () => {
    const user = userEvent.setup()
    renderApp(`/beans/bag-b-geisha`, {
      mock: {
        ...mock,
        drafts: [
          {
            beanId: 'b-geisha',
            method: 'v60',
            choices: { bagId: 'bag-b-geisha', balance: 0, strength: 'medium', grinderId: null, filterId: null, cups: 2, edits: { doseG: 18, tempC: 91 } },
            lastBrew: null,
            updatedAt: '2026-10-16T08:00:00Z',
          },
        ],
      },
    })
    await user.click(await screen.findByRole('link', { name: /Where you left off/ }))
    const specs = await screen.findByLabelText('Recipe')
    expect(within(specs).getByText('Coffee').nextSibling).toHaveTextContent('18 g')
    expect(within(specs).getByText('Water temp').nextSibling).toHaveTextContent('91°C')
  })
})
