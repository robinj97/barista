import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { StoredSuggestion } from '../../supabase/functions/suggest-tweak/suggest.ts'
import { SuggestError, type BrewResult, type Draft } from '../data/types'
import type { MockOptions } from '../dev/mockApi'
import { makeBag, renderApp } from '../test/renderApp'

const geisha = makeBag('b-geisha', { createdAt: '2026-10-14T10:00:00Z' })
const at = '/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2'
const BREWED_AT = '2026-10-16T08:00:00Z'

const lastBrew: BrewResult = {
  brewedAt: BREWED_AT, totalTimeS: 170, tastes: ['weak', 'flat'], improve: ['body'], compared: null, yieldG: null,
  notes: 'Need to go finer next time.', firstPourG: 60,
  recipe: { doseG: 20, waterG: 300, ratio: 15, tempC: 93, grindUm: 800, targetTimeS: 210, pours: [{ atS: 0, toG: 60 }, { atS: 45, toG: 120 }, { atS: 85, toG: 300 }] },
}
const draft = (over: Partial<Draft> = {}): Draft => ({
  beanId: 'b-geisha', method: 'v60', choices: { bagId: 'bag-b-geisha', balance: 0, strength: 'medium', grinderId: null, filterId: null, cups: 2, edits: {} },
  lastBrew, suggestion: null, updatedAt: BREWED_AT, ...over,
})
const saved: StoredSuggestion = {
  forBrewedAt: BREWED_AT, kind: 'change', changes: [{ direction: 'finer', amount: 30 }], test: false,
  reason: 'Weak and flat usually means under-extracted.', quote: null, lookFor: 'A fuller cup.', plan: 'agrees',
  model: 'claude-haiku-5-5', effort: 'medium', promptVersion: '3', createdAt: BREWED_AT, appliedAt: null,
}
const mock = (over: MockOptions = {}): MockOptions => ({ bags: [geisha], drafts: [draft()], ...over })

const lastBrewCard = async () => screen.findByRole('region', { name: 'Last brew' })
/** Lets the features query finish, so a missing button really means it isn't offered. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)))
const grind = () => within(screen.getByRole('region', { name: 'Grind' })).getByText(/µm/).parentElement!.textContent

describe('Suggest a tweak', () => {
  it('is only offered to people with the feature', async () => {
    renderApp(at, { mock: mock({ features: [] }) })
    await lastBrewCard()
    await settle()
    expect(screen.queryByRole('button', { name: /suggest a tweak/i })).not.toBeInTheDocument()
  })

  it('is not offered when the last brew kept no numbers', async () => {
    renderApp(at, { mock: mock({ drafts: [draft({ lastBrew: { ...lastBrew, recipe: undefined } })] }) })
    await lastBrewCard()
    await settle()
    expect(screen.queryByRole('button', { name: /suggest a tweak/i })).not.toBeInTheDocument()
  })

  it('asks only when tapped, applies the change to the recipe, and undoes it', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock: mock() })
    const card = await lastBrewCard()
    expect(within(card).queryByRole('region', { name: 'Suggestion' })).not.toBeInTheDocument()
    await user.click(await within(card).findByRole('button', { name: /suggest a tweak/i }))

    const suggestion = await within(card).findByRole('region', { name: 'Suggestion' })
    // Starts from what was brewed (800 µm), not from the engine's 820 µm on screen, and says nothing about an edit.
    expect(within(suggestion).getByText('Try: Grind finer: 800 → 770 µm')).toBeInTheDocument()
    expect(within(suggestion).queryByText(/already changed/)).not.toBeInTheDocument()
    expect(grind()).toContain('820')

    await user.click(within(suggestion).getByRole('button', { name: 'Apply to recipe' }))
    expect(grind()).toContain('770')
    expect(within(suggestion).getByText('Applied')).toBeInTheDocument()
    expect(within(suggestion).queryByText(/already changed/)).not.toBeInTheDocument()

    await user.click(within(suggestion).getByRole('button', { name: 'Undo' }))
    expect(grind()).toContain('820')
    expect(await within(suggestion).findByRole('button', { name: 'Apply to recipe' })).toBeInTheDocument()
    expect(within(suggestion).queryByText('Applied')).not.toBeInTheDocument()
  })

  it('shows the saved suggestion for this brew straight away, without a button', async () => {
    renderApp(at, { mock: mock({ drafts: [draft({ suggestion: saved })] }) })
    const card = await lastBrewCard()
    expect(await within(card).findByText(saved.reason)).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /suggest a tweak/i })).not.toBeInTheDocument()
  })

  it('offers a new suggestion when the saved one is for an older brew', async () => {
    renderApp(at, { mock: mock({ drafts: [draft({ suggestion: { ...saved, forBrewedAt: '2026-10-15T08:00:00Z' } })] }) })
    const card = await lastBrewCard()
    expect(await within(card).findByRole('button', { name: /suggest a tweak/i })).toBeInTheDocument()
  })

  it('folds away with Not now and opens again without asking', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock: mock({ drafts: [draft({ suggestion: saved })] }) })
    const card = await lastBrewCard()
    await user.click(await within(card).findByRole('button', { name: 'Not now' }))
    expect(within(card).queryByText(saved.reason)).not.toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: /see suggestion/i }))
    expect(within(card).getByText(saved.reason)).toBeInTheDocument()
  })

  it('shows a lock answer without anything to apply', async () => {
    renderApp(at, { mock: mock({ drafts: [draft({ suggestion: { ...saved, kind: 'lock', changes: [] } })] }) })
    const card = await lastBrewCard()
    expect(await within(card).findByText('This one sounds like a keeper.')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Apply to recipe' })).not.toBeInTheDocument()
  })

  it('says when the day’s suggestions are used up', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock: mock({ suggest: new SuggestError('limit') }) })
    const card = await lastBrewCard()
    await user.click(await within(card).findByRole('button', { name: /suggest a tweak/i }))
    expect(await within(card).findByText("That's all your suggestions for today. More tomorrow.")).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('says when offline, and lets you try again', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock: mock({ isOffline: () => true }) })
    const card = await lastBrewCard()
    await user.click(await within(card).findByRole('button', { name: /suggest a tweak/i }))
    expect(await within(card).findByText("You're offline. Suggestions need a connection.")).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('allows one retry after a failure, then stops offering', async () => {
    const user = userEvent.setup()
    renderApp(at, { mock: mock({ suggest: new SuggestError('failed') }) })
    const card = await lastBrewCard()
    await user.click(await within(card).findByRole('button', { name: /suggest a tweak/i }))
    await user.click(await within(card).findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(within(card).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument())
    expect(within(card).getByText("Couldn't get a suggestion just now.")).toBeInTheDocument()
  })

  it('records on the next logged brew whether the suggestion was applied', async () => {
    const user = userEvent.setup()
    const session = { bagId: 'bag-b-geisha', search: at.split('?')[1], asOf: '2026-10-17', startedAt: Date.now() - 200_000, finishedS: null }
    localStorage.setItem('barista.brew-session', JSON.stringify(session))
    const { api } = renderApp(at, { mock: mock({ drafts: [draft({ suggestion: { ...saved, appliedAt: '2026-10-16T09:00:00Z' } })] }) })
    await user.click(await screen.findByRole('button', { name: 'Drawdown finished' }))
    await screen.findByRole('heading', { name: 'How did it go?' })
    await user.click(screen.getByRole('button', { name: 'Sour' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      const [saved] = await api.listMyDrafts()
      expect(saved?.lastBrew?.followed).toEqual({ directions: ['finer'], applied: true })
    })
  })
})
