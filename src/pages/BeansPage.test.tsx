import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeBag, renderApp } from '../test/renderApp'

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add a bag' }))
  return screen.findByLabelText('Search roaster or bean')
}

describe('Beans: empty state', () => {
  it('invites you to add your first bag, with no floating button yet', async () => {
    renderApp('/beans')
    expect(await screen.findByRole('heading', { name: 'Add your first bag' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add a bag' })).toHaveLength(1)
    expect(screen.queryByRole('group', { name: 'Filter beans' })).not.toBeInTheDocument()
  })
})

describe('Beans: your list', () => {
  const bags = [
    makeBag('b-elto', { status: 'locked' }),
    makeBag('b-pink', { status: 'dialing_in' }),
    makeBag('b-geisha', { status: 'new' }),
  ]

  it('shows real bags with a floating add button and no empty state', async () => {
    renderApp('/beans', { mock: { bags } })
    expect(await screen.findByText('Pink Bourbon')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Add your first bag' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a bag' })).toBeInTheDocument()
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    renderApp('/beans', { mock: { bags } })
    await screen.findByText('Pink Bourbon')
    await user.click(screen.getByRole('button', { name: 'Locked' }))
    expect(screen.getByText('Elto Arbegona')).toBeInTheDocument()
    expect(screen.queryByText('Pink Bourbon')).not.toBeInTheDocument()
  })
})

describe('Adding a bag', () => {
  it('finds an existing bean, adds the bag and opens its page', async () => {
    const user = userEvent.setup()
    const { api } = renderApp('/beans')
    await user.type(await openSheet(user), 'elto')

    expect(await screen.findByText('A friend has this dialed in')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Elto Arbegona/ }))
    await user.click(screen.getByRole('radio', { name: '1 week ago' }))
    await user.click(screen.getByRole('radio', { name: '250 g' }))
    await user.click(screen.getByRole('button', { name: 'Add to my beans' }))

    expect(await screen.findByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
    const bag = await screen.findByRole('region', { name: 'Your bag' })
    expect(within(bag).getByText('7 days ago')).toBeInTheDocument()
    expect(within(bag).getByText('250 g')).toBeInTheDocument()
    expect(await api.listMyBags()).toHaveLength(1)
  })

  it('lets you skip roast date and size', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await user.type(await openSheet(user), 'pink')
    await user.click(await screen.findByRole('button', { name: /Pink Bourbon/ }))
    await user.click(screen.getByRole('button', { name: 'Add to my beans' }))
    const bag = await screen.findByRole('region', { name: 'Your bag' })
    expect(within(bag).getByText('Date not set')).toBeInTheDocument()
  })

  it('creates a brand-new bean with its details', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await user.type(await openSheet(user), 'Sibarist Test')
    await user.click(await screen.findByRole('button', { name: /as a new bean/ }))

    expect(screen.getByLabelText('Name')).toHaveValue('Sibarist Test')
    await user.type(screen.getByLabelText('Roaster'), 'Sibarist')
    await user.click(screen.getByRole('radio', { name: 'Washed' }))
    await user.click(screen.getByRole('radio', { name: 'Light' }))
    await user.type(screen.getByLabelText('Tasting notes from the bag'), 'jasmine{Enter}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Add to my beans' }))

    expect(await screen.findByRole('heading', { name: 'Sibarist Test' })).toBeInTheDocument()
    const about = await screen.findByRole('region', { name: 'About this coffee' })
    expect(within(about).getByText('Washed')).toBeInTheDocument()
    expect(within(about).getByText('Light')).toBeInTheDocument()
    expect(within(about).getByText('jasmine')).toBeInTheDocument()
  })

  it('asks for a roaster and a name', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await user.type(await openSheet(user), 'x')
    await user.click(await screen.findByRole('button', { name: /as a new bean/ }))
    await user.clear(screen.getByLabelText('Name'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual(['Enter a roaster', 'Enter a name'])
  })

  it('checks the optional fields too', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await user.type(await openSheet(user), 'x')
    await user.click(await screen.findByRole('button', { name: /as a new bean/ }))
    await user.type(screen.getByLabelText('Roaster'), 'R')
    await user.click(screen.getByText('More details'))
    await user.type(screen.getByLabelText('Altitude (m)'), '99999')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter metres, 1 to 5000')
  })

  it('suggests an existing bean while a new one is typed', async () => {
    const user = userEvent.setup()
    renderApp('/beans')
    await user.type(await openSheet(user), 'x')
    await user.click(await screen.findByRole('button', { name: /as a new bean/ }))
    await user.type(screen.getByLabelText('Roaster'), 'Coffea Circulor')
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Elto')
    await user.click(await screen.findByRole('button', { name: 'Use Elto Arbegona' }))
    expect(await screen.findByRole('button', { name: 'Add to my beans' })).toBeInTheDocument()
    expect(screen.getByText('Elto Arbegona')).toBeInTheDocument()
  })

  it('opens the bag you already have instead of adding a duplicate', async () => {
    const user = userEvent.setup()
    renderApp('/beans', { mock: { bags: [makeBag('b-elto')] } })
    await user.type(await openSheet(user), 'elto')
    expect(await screen.findByText('In your beans')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Elto Arbegona/ }))
    expect(await screen.findByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your bag' })).toBeInTheDocument()
  })

  it('says so, and takes the bag back out, when saving fails', async () => {
    const user = userEvent.setup()
    renderApp('/beans', { mock: { failAddBag: true } })
    await user.type(await openSheet(user), 'pink')
    await user.click(await screen.findByRole('button', { name: /Pink Bourbon/ }))
    await user.click(screen.getByRole('button', { name: 'Add to my beans' }))
    expect(await screen.findByText(/Couldn't add Pink Bourbon/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Bag not found' })).toBeInTheDocument()
  })
})

describe('Bean page', () => {
  it('shows the bean, your bag and a way to start dialing in', async () => {
    renderApp('/beans/bag-b-elto', { mock: { bags: [makeBag('b-elto', { roastDate: '2026-10-01' })] } })
    expect(await screen.findByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
    expect(screen.getByText('Sidama')).toBeInTheDocument()
    expect(screen.getByText('bergamot')).toBeInTheDocument()
    expect(screen.getByText(/No recipes yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start dialing in' })).toHaveAttribute('href', '/brew')
  })

  it('removes a bag after confirming', async () => {
    const user = userEvent.setup()
    const { api } = renderApp('/beans/bag-b-elto', { mock: { bags: [makeBag('b-elto')] } })
    await user.click(await screen.findByRole('button', { name: 'Remove this bag' }))
    await user.click(await screen.findByRole('button', { name: 'Remove bag' }))
    expect(await screen.findByRole('heading', { name: 'Add your first bag' })).toBeInTheDocument()
    expect(await api.listMyBags()).toHaveLength(0)
  })

  it('handles a bag that does not exist', async () => {
    renderApp('/beans/nope')
    expect(await screen.findByRole('heading', { name: 'Bag not found' })).toBeInTheDocument()
  })
})
