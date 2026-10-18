import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CHOICES } from '../brew/params'
import type { Draft } from '../data/types'
import { makeBag, renderApp } from '../test/renderApp'

const elto = makeBag('b-elto', { createdAt: '2026-10-10T10:00:00Z' })
const geisha = makeBag('b-geisha', { createdAt: '2026-10-14T10:00:00Z' })
const draftFor = (beanId: string, bagId: string, updatedAt: string, choices: Partial<Draft['choices']> = {}): Draft => ({
  beanId,
  method: 'v60',
  choices: { ...DEFAULT_CHOICES, bagId, ...choices },
  lastBrew: null,
  updatedAt,
})

describe('Bag management', () => {
  it('edits how much is left and the roast date', async () => {
    const user = userEvent.setup()
    renderApp('/beans/bag-b-geisha', { mock: { bags: [geisha] } })
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const left = await screen.findByLabelText('Left in the bag (g)')
    await user.clear(left)
    await user.type(left, '180')
    await user.type(screen.getByLabelText('Roasted'), '01102026')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const bag = await screen.findByRole('region', { name: 'Your bag' })
    expect(within(bag).getByText('180 g')).toBeInTheDocument()
    expect(within(bag).queryByText('Date not set')).not.toBeInTheDocument()
  })

  it('refuses a roast date that is not real or is in the future', async () => {
    const user = userEvent.setup()
    renderApp('/beans/bag-b-geisha', { mock: { bags: [geisha] } })
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.type(await screen.findByLabelText('Roasted'), '31022026')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Use the form dd/mm/yyyy')).toBeInTheDocument()
  })

  it('marks a bag finished: it leaves All and shows under Finished, and can come back', async () => {
    const user = userEvent.setup()
    renderApp('/beans/bag-b-geisha', { mock: { bags: [geisha, elto] } })
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Mark as finished' }))
    expect(within(await screen.findByRole('region', { name: 'Your bag' })).getByText('Finished')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Back to beans' }))
    expect(await screen.findByRole('link', { name: /Elto Arbegona/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Tanzania Geisha/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finished' }))
    await user.click(await screen.findByRole('link', { name: /Tanzania Geisha/ }))

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Back in use' }))
    expect(within(await screen.findByRole('region', { name: 'Your bag' })).queryByText('Finished')).not.toBeInTheDocument()
  })

  it('leaves finished bags out of Brew', async () => {
    renderApp('/brew', { mock: { bags: [geisha, elto].map((b) => (b.id === geisha.id ? { ...b, finishedAt: '2026-10-16T10:00:00Z' } : b)) } })
    const bean = await screen.findByRole('region', { name: 'Bean' })
    expect(within(bean).getByText('Elto Arbegona')).toBeInTheDocument()
  })

  it('says so on Brew when every bag is finished', async () => {
    renderApp('/brew', { mock: { bags: [{ ...geisha, finishedAt: '2026-10-16T10:00:00Z' }] } })
    expect(await screen.findByText(/All your bags are marked finished/)).toBeInTheDocument()
  })

  it('warns when a bag is running low, on the card and the bean page', async () => {
    renderApp('/beans', { mock: { bags: [{ ...geisha, gramsRemaining: 50 }, { ...elto, gramsRemaining: 250 }] } })
    const cards = await screen.findAllByRole('link', { name: /Elto|Geisha/ })
    expect(cards.find((c) => c.textContent?.includes('Geisha'))).toHaveTextContent('Running low · about 2 brews left')
    expect(cards.find((c) => c.textContent?.includes('Elto'))).not.toHaveTextContent('Running low')
  })

  it('says empty at 0 g, and warns on the bean page too', async () => {
    renderApp('/beans/bag-b-geisha', { mock: { bags: [{ ...geisha, gramsRemaining: 0 }] } })
    expect(await within(await screen.findByRole('region', { name: 'Your bag' })).findByText('Empty')).toBeInTheDocument()
  })
})

describe('Brew starts where you left off', () => {
  it('opens on the bean you brewed most recently', async () => {
    renderApp('/brew', { mock: { bags: [elto, geisha], drafts: [draftFor('b-elto', elto.id, '2026-10-17T10:00:00Z'), draftFor('b-geisha', geisha.id, '2026-10-12T10:00:00Z')] } })
    const bean = await screen.findByRole('region', { name: 'Bean' })
    expect(within(bean).getByText('Elto Arbegona')).toBeInTheDocument()
  })

  it('skips a most recent bean whose bag is finished', async () => {
    renderApp('/brew', {
      mock: { bags: [{ ...elto, finishedAt: '2026-10-16T10:00:00Z' }, geisha], drafts: [draftFor('b-elto', elto.id, '2026-10-17T10:00:00Z')] },
    })
    const bean = await screen.findByRole('region', { name: 'Bean' })
    expect(within(bean).getByText('Tanzania Geisha')).toBeInTheDocument()
  })

  it('uses the grinder and filter of your last brew', async () => {
    renderApp('/brew', {
      mock: {
        bags: [geisha],
        grinderIds: ['turin-df54', 'kingrinder-k7'],
        filterIds: ['f-cafec-t90', 'f-hario-v60'],
        drafts: [draftFor('b-geisha', geisha.id, '2026-10-17T10:00:00Z', { grinderId: 'kingrinder-k7', filterId: 'f-hario-v60' })],
      },
    })
    const gear = await screen.findByRole('region', { name: 'Your gear' })
    expect(await within(gear).findByRole('button', { name: /Grinder/ })).toHaveTextContent('K7')
    expect(within(gear).getByRole('button', { name: /Filter/ })).toHaveTextContent('V60')
  })

  it('saves the gear you brewed with, so the next brew starts on it', async () => {
    const user = userEvent.setup()
    const { api } = renderApp('/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2', {
      mock: { bags: [geisha], grinderIds: ['turin-df54', 'kingrinder-k7'], filterIds: ['f-cafec-t90'] },
    })
    await user.click(await screen.findByRole('button', { name: 'Start brewing' }))
    await waitFor(async () => expect((await api.listMyDrafts())[0]?.choices.grinderId).toBeTruthy())
    expect((await api.listMyDrafts())[0]?.choices.filterId).toBe('f-cafec-t90')
  })
})

describe('Removing a friend', () => {
  const friend = { id: 'friend-1', name: 'Sam', avatarUrl: null, since: '2026-10-01T10:00:00Z' }

  it('asks first, then removes them from your friends', async () => {
    const user = userEvent.setup()
    renderApp('/friends', { mock: { friends: [friend] } })
    await user.click(await screen.findByRole('button', { name: 'Remove Sam' }))
    expect(await screen.findByText(/You'll stop seeing each other's locked recipes/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText(/No friends yet/)).toBeInTheDocument()
  })

  it('keeps them if you change your mind', async () => {
    const user = userEvent.setup()
    renderApp('/friends', { mock: { friends: [friend] } })
    await user.click(await screen.findByRole('button', { name: 'Remove Sam' }))
    await user.click(await screen.findByRole('button', { name: 'Keep' }))
    expect(within(screen.getByRole('region', { name: 'Your friends' })).getByText('Sam')).toBeInTheDocument()
  })
})

describe('The iPhone install prompt', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  afterEach(() => vi.restoreAllMocks())

  it('shows how to add the app on an iPhone, until dismissed for good', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iphone)
    renderApp('/beans')
    const card = await screen.findByRole('region', { name: 'Install Barista' })
    expect(card).toHaveTextContent('Add to Home Screen')
    await user.click(within(card).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('region', { name: 'Install Barista' })).not.toBeInTheDocument()
    expect(localStorage.getItem('barista.install-dismissed')).toBe('yes')
  })

  it('stays away once dismissed, once installed, and on other devices', async () => {
    renderApp('/beans')
    await screen.findByRole('heading', { name: 'Beans' })
    expect(screen.queryByRole('region', { name: 'Install Barista' })).not.toBeInTheDocument()
  })

  it('does not show on an iPhone that has the app installed', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iphone)
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    renderApp('/beans')
    await screen.findByRole('heading', { name: 'Beans' })
    expect(screen.queryByRole('region', { name: 'Install Barista' })).not.toBeInTheDocument()
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true })
  })
})
