import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pendingCount } from '../data/outbox'
import { makeBag, renderApp } from '../test/renderApp'

const geisha = makeBag('b-geisha', { createdAt: '2026-10-14T10:00:00Z' })
const at = '/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2'
const mock = { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'] }

const session = (secondsAgo: number, extra: object = {}) =>
  JSON.stringify({ bagId: 'bag-b-geisha', search: at.split('?')[1], asOf: '2026-10-17', startedAt: Date.now() - secondsAgo * 1000, finishedS: null, ...extra })

/** A brew whose schedule has run out, so the drawdown button is showing when the screen opens. */
const drawdown = () => localStorage.setItem('barista.brew-session', session(200))

/** Taps the one button of a finished schedule, which lands on the log screen. */
async function brew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Drawdown finished' }))
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
    expect(screen.queryByRole('button', { name: /Pour \d done/ })).not.toBeInTheDocument()
    // The recipe can no longer be edited while brewing.
    expect(screen.queryByRole('radio', { name: 'Recipe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit pours' })).not.toBeInTheDocument()
  })

  it('has no buttons between pours: it follows the schedule', async () => {
    localStorage.setItem('barista.brew-session', session(50))
    renderApp(at, { mock })
    // 50 s in: pour 1 is over, pour 2 (from 0:45) is under way.
    expect(await screen.findByText(/Pour 2: up to 120 g/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pour \d done/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drawdown finished' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Pour progress' })).getAllByRole('listitem')[0]).toHaveTextContent('✓')
  })

  it('keeps the current pour highlighted until the next one begins, and ticks it then', async () => {
    // 30 s in: pour 1 has gone in (15 s), pour 2 starts at 0:45. Pour 1 is still the current row.
    localStorage.setItem('barista.brew-session', session(30))
    renderApp(at, { mock })
    const rows = within(await screen.findByRole('list', { name: 'Pour progress' })).getAllByRole('listitem')
    expect(rows[0]).toHaveAttribute('aria-current', 'step')
    expect(rows[0]).not.toHaveTextContent('✓')
    expect(rows.filter((row) => row.getAttribute('aria-current') === 'step')).toHaveLength(1)
  })

  it('counts down to the next pour between pours', async () => {
    localStorage.setItem('barista.brew-session', session(30))
    renderApp(at, { mock })
    expect(await screen.findByText(/Pour 2 in 0:1\d, up to 120 g/)).toBeInTheDocument()
  })

  it('switches to the drawdown once the last pour is over', async () => {
    localStorage.setItem('barista.brew-session', session(200))
    renderApp(at, { mock })
    expect(await screen.findByText(/Drawdown: let it drain/)).toBeInTheDocument()
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
    localStorage.setItem('barista.brew-session', session(41))
    renderApp(at, { mock })
    expect(await screen.findByRole('timer')).toHaveTextContent('0:4')
    expect(screen.getByText(/Pour 2 in/)).toBeInTheDocument()
  })

  it('offers to finish logging a brew that was never saved', async () => {
    localStorage.setItem('barista.brew-session', session(200, { finishedS: 190 }))
    renderApp(at, { mock })
    expect(await screen.findByRole('link', { name: /Finish logging your last brew/ })).toHaveAttribute('href', '/brew/log')
  })
})

describe('Logging', () => {
  it('saves your working recipe and shows it on the bean as where you left off', async () => {
    drawdown()
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

  it('uses the coffee up when the drawdown ends and marks the bag as dialing in', async () => {
    const user = userEvent.setup()
    drawdown()
    renderApp(at, { mock })
    await user.click(await screen.findByRole('button', { name: 'Drawdown finished' }))
    await screen.findByRole('heading', { name: 'How did it go?' })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { name: 'Tanzania Geisha' })
    const bag = await screen.findByRole('region', { name: 'Your bag' })
    expect(within(bag).getByText('230 g')).toBeInTheDocument()
    expect(within(bag).getByText('Dialing in')).toBeInTheDocument()
  })

  it('can be finished without the timer: same bag changes, and no total time is logged', async () => {
    const user = userEvent.setup()
    const { api } = renderApp(at, { mock })
    await user.click(await screen.findByRole('button', { name: 'Start brewing' }))
    await user.click(await screen.findByRole('button', { name: 'Finished brewing' }))
    expect(await screen.findByRole('heading', { name: 'How did it go?' })).toBeInTheDocument()
    expect(screen.queryByText(/total/)).not.toBeInTheDocument()
    const [bag] = await api.listMyBags()
    expect(bag?.gramsRemaining).toBe(230)
    expect(bag?.status).toBe('dialing_in')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Tanzania Geisha' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Where you left off/ })).toBeInTheDocument()
  })

  it('does not touch the bag when a brew is cancelled', async () => {
    const user = userEvent.setup()
    localStorage.setItem('barista.brew-session', session(20))
    const { api } = renderApp(at, { mock })
    await user.click(await screen.findByRole('button', { name: 'Cancel brew' }))
    await user.click(screen.getByRole('button', { name: 'Yes, cancel this brew' }))
    expect(await screen.findByRole('button', { name: 'Start brewing' })).toBeInTheDocument()
    const [bag] = await api.listMyBags()
    expect(bag?.gramsRemaining).toBe(250)
    expect(bag?.status).toBe('new')
  })

  it('asks how it compares only when there was a previous brew', async () => {
    drawdown()
    const user = userEvent.setup()
    renderApp(at, { mock })
    await brew(user)
    expect(screen.queryByRole('region', { name: 'Compared with last time' })).not.toBeInTheDocument()
  })

  it('asks how it compares with last time when there was one', async () => {
    drawdown()
    const user = userEvent.setup()
    renderApp(at, {
      mock: {
        ...mock,
        drafts: [
          {
            beanId: 'b-geisha',
            method: 'v60',
            choices: { bagId: 'bag-b-geisha', balance: 0, strength: 'medium', grinderId: null, filterId: null, cups: 2, edits: {} },
            lastBrew: { brewedAt: '2026-10-16T08:00:00Z', totalTimeS: 170, taste: 'sour', compared: null, yieldG: null, notes: '', firstPourG: 60 },
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
    drawdown()
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
    expect(within(screen.getByRole('region', { name: 'Your bag' })).getByText('Locked')).toBeInTheDocument()
  })

  it('refuses a yield that is not a number', async () => {
    drawdown()
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
    drawdown()
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
