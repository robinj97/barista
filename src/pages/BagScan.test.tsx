import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_SCAN } from '../../supabase/functions/scan-bag/label'
import { MOCK_SCAN } from '../dev/mockApi'
import { ScanError, type ScannedBag } from '../data/types'
import { makeBag, renderApp } from '../test/renderApp'

// jsdom has no canvas; shrinking is covered by the browser, the flow is covered here.
vi.mock('../beans/photo', () => ({ shrinkPhoto: async () => 'photo-base64' }))

const photo = new File(['jpeg'], 'bag.jpg', { type: 'image/jpeg' })

async function scanBag(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add a bag' }))
  expect(await screen.findByRole('button', { name: 'Scan the bag' })).toBeInTheDocument()
  await user.upload(screen.getByTestId('bag-photo'), photo)
}

describe('Scanning a bag photo', () => {
  it('fills the new-bean form from the label, then the bag, and saves after a check', async () => {
    const user = userEvent.setup()
    const { api } = renderApp('/beans')
    await scanBag(user)

    expect(await screen.findByText(/Filled in from your photo. Check it/)).toBeInTheDocument()
    expect(screen.getByLabelText('Roaster')).toHaveValue('Sey')
    expect(screen.getByLabelText('Name')).toHaveValue('Gatomboya AA')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Size filled in from your photo. Check before adding.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '250 g' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Add to my beans' }))

    expect(await screen.findByRole('heading', { name: 'Gatomboya AA' })).toBeInTheDocument()
    const [bag] = await api.listMyBags()
    expect(bag.bean).toMatchObject({ roaster: 'Sey', origin: 'Kenya', variety: 'SL28, SL34' })
    expect(bag.gramsRemaining).toBe(250)
  })

  it('goes straight to the bag for a bean already in the catalogue', async () => {
    const user = userEvent.setup()
    const scan: ScannedBag = { ...MOCK_SCAN, roaster: 'Coffea Circulor', name: 'Elto Arbegona', roastDate: null, weightG: 340 }
    renderApp('/beans', { mock: { scan } })
    await scanBag(user)

    expect(await screen.findByRole('radio', { name: '340 g' })).toBeChecked()
    expect(screen.getByText('Size filled in from your photo. Check before adding.')).toBeInTheDocument()
    expect(screen.getByText('Elto Arbegona')).toBeInTheDocument()
    expect(screen.queryByLabelText('Roaster')).not.toBeInTheDocument()
  })

  it('opens your bag when you already have that bean', async () => {
    const user = userEvent.setup()
    const scan: ScannedBag = { ...MOCK_SCAN, roaster: 'Coffea Circulor', name: 'Elto Arbegona' }
    renderApp('/beans', { mock: { scan, bags: [makeBag('b-elto')] } })
    await scanBag(user)

    expect(await screen.findByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to my beans' })).not.toBeInTheDocument()
  })

  it('says so when the label cannot be read, and stays on search', async () => {
    const user = userEvent.setup()
    renderApp('/beans', { mock: { scan: { ...EMPTY_SCAN } } })
    await scanBag(user)

    expect(await screen.findByText(/Couldn't read that label/)).toBeInTheDocument()
    expect(screen.getByLabelText('Search roaster or bean')).toBeInTheDocument()
  })

  it('explains a failed scan without losing the sheet', async () => {
    const user = userEvent.setup()
    renderApp('/beans', { mock: { scan: new ScanError('busy') } })
    await scanBag(user)

    expect(await screen.findByText(/Scanning is busy right now/)).toBeInTheDocument()
    expect(screen.getByLabelText('Search roaster or bean')).toBeInTheDocument()
  })
})

describe('Scanned roast date', () => {
  it('fills the roast date as a picked date when the label has one', async () => {
    const user = userEvent.setup()
    const scan: ScannedBag = { ...MOCK_SCAN, roaster: 'Coffea Circulor', name: 'Elto Arbegona', roastDate: '2026-10-01', weightG: null }
    renderApp('/beans', { mock: { scan } })
    await scanBag(user)

    expect(await screen.findByText('Roast date filled in from your photo. Check before adding.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pick date' })).toBeChecked()
    expect(screen.getByDisplayValue('01/10/2026')).toBeInTheDocument()
  })
})

describe('Daily scan limit', () => {
  it('says when today\'s scans are used up', async () => {
    const user = userEvent.setup()
    renderApp('/beans', { mock: { scan: new ScanError('limit') } })
    await scanBag(user)

    expect(await screen.findByText(/That's your 10 scans for today/)).toBeInTheDocument()
    expect(screen.getByLabelText('Search roaster or bean')).toBeInTheDocument()
  })
})
