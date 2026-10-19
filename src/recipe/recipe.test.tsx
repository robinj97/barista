import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { GRINDER_SEED } from '../../engine/grinderSeed.ts'
import { suggest } from '../../engine/suggest.ts'
import type { PriorRecipe, SuggestOutput } from '../../engine/types.ts'
import { buildSuggestInput } from '../brew/buildInput'
import { DEFAULT_CHOICES, type BrewChoices } from '../brew/params'
import type { MyGrinder } from '../data/types'
import { makeBag } from '../test/renderApp'
import { ConfidencePill } from './ConfidencePill'
import { GrindCard } from './GrindCard'
import { buildRecipeModel, type RecipeModel } from './model'

const bag = makeBag('b-geisha')
const grinderOf = (id: string): MyGrinder => ({ grinder: GRINDER_SEED.find((g) => g.id === id)!, nickname: null, offsetUm: 0 })

function model(choices: Partial<BrewChoices> = {}, grinder?: MyGrinder, context?: Parameters<typeof buildSuggestInput>[4]): RecipeModel {
  const merged = { ...DEFAULT_CHOICES, bagId: bag.id, ...choices }
  const recipeFor = (next: BrewChoices) => suggest(buildSuggestInput(bag, next, null, '2026-10-17', context))
  return buildRecipeModel({ bag, choices: merged, out: recipeFor(merged), unit: 'c', grinder, filter: null, apply: vi.fn(), recompute: (next) => recipeFor(next).recipe })
}

describe('buildRecipeModel', () => {
  it('works the recipe out once: text, the ratio and water as shown, and the grind in your grinder', () => {
    const m = model({}, grinderOf('turin-df54'))
    expect(m.text).toMatchObject({ coffee: '20 g', water: '300 g', ratio: '1:15' })
    expect(m.shown).toEqual({ ratio: 15, waterG: 300 })
    expect(m.converted?.setting).toBeGreaterThan(0)
  })

  it('has no converted grind without a grinder, or with one that cannot be converted', () => {
    expect(model().converted).toBeNull()
    expect(model({}, grinderOf('lopder-maxa')).converted).toBeNull()
  })

  it('knows what you set by hand', () => {
    const m = model({ edits: { tempC: 90 } })
    expect(m.has('tempC')).toBe(true)
    expect(m.has('doseG', 'waterG')).toBe(false)
    expect(m.isOverridden('tempC')).toBe(true)
    expect(m.isOverridden('doseG')).toBe(false)
  })

  it('applies changes through the function it was given', () => {
    const m = model()
    m.apply({ ...m.choices, cups: 3 })
    expect(m.apply).toHaveBeenCalledWith(expect.objectContaining({ cups: 3 }))
  })
})

describe('ConfidencePill', () => {
  const pill = (out: SuggestOutput) => {
    render(<ConfidencePill out={out} onOpen={() => {}} />)
    return screen.getByRole('button')
  }
  const base = model().out
  const friend: PriorRecipe = { method: 'v60', beanId: 'b-geisha', bean: { notes: [] }, tempC: 92, grindUm: 700, from: 'Sam' }

  it('says it is a starting point when nothing else is known', () => {
    expect(pill(base)).toHaveTextContent('Starting point · expect 2–3 brews')
  })

  it("names a friend whose recipe it starts from", () => {
    expect(pill(model({}, undefined, { own: [], friends: [{ ...friend }] }).out)).toHaveTextContent("Based on Sam's locked recipe")
  })

  it('says it is your own recipe', () => {
    expect(pill(model({}, undefined, { own: [{ ...friend, from: undefined }], friends: [] }).out)).toHaveTextContent('Based on your own recipe')
  })

  it('says you changed it, whatever it started from', () => {
    expect(pill(model({ edits: { tempC: 90 } }).out)).toHaveTextContent('Your edits · started from a suggestion')
  })

  it('opens the reasons when tapped', async () => {
    const onOpen = vi.fn()
    render(<ConfidencePill out={base} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
  })
})

describe('GrindCard', () => {
  const card = (m: RecipeModel) =>
    render(
      <MemoryRouter>
        <GrindCard model={m} onEdit={() => {}} />
      </MemoryRouter>,
    )

  it("shows the grind in your grinder's units and the size", () => {
    card(model({}, grinderOf('turin-df54')))
    expect(screen.getByText('dial')).toBeInTheDocument()
    expect(screen.getByText(/About \d+ µm/)).toBeInTheDocument()
  })

  it('warns that an estimated calibration is rough', () => {
    card(model({}, grinderOf('kingrinder-k7')))
    expect(screen.getByText('Rough estimate')).toBeInTheDocument()
  })

  it('falls back to microns for a grinder it cannot convert, and says so', () => {
    card(model({}, grinderOf('lopder-maxa')))
    expect(screen.getByText('µm')).toBeInTheDocument()
    expect(screen.getByText(/can't convert to Lopder MAXA yet/)).toBeInTheDocument()
  })

  it('invites you to add a grinder when you have none', () => {
    card(model())
    expect(screen.getByRole('link', { name: 'Add your grinder to see clicks' })).toHaveAttribute('href', '/profile')
  })

  it('marks a grind you set yourself', () => {
    const { container } = render(
      <MemoryRouter>
        <GrindCard model={model({ edits: { grindUm: 700 } }, grinderOf('turin-df54'))} onEdit={() => {}} />
      </MemoryRouter>,
    )
    expect(container.querySelector('.bg-accent.rounded-full')).not.toBeNull()
  })
})
