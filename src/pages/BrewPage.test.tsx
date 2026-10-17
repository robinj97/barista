import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeBag, renderApp } from '../test/renderApp'

const elto = makeBag('b-elto', { createdAt: '2026-10-10T10:00:00Z' })
const geisha = makeBag('b-geisha', { createdAt: '2026-10-14T10:00:00Z' })

describe('Brew: set up', () => {
  it('asks for a bean first when you have none', async () => {
    renderApp('/brew')
    expect(await screen.findByRole('heading', { name: 'Add a bean first' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Beans' })).toHaveAttribute('href', '/beans')
  })

  it('starts with your newest bean and lets you switch', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [elto, geisha] } })
    const bean = await screen.findByRole('region', { name: 'Bean' })
    expect(within(bean).getByText('Tanzania Geisha')).toBeInTheDocument()

    await user.click(within(bean).getByRole('button'))
    await user.click(await screen.findByRole('button', { name: /Elto Arbegona/ }))
    expect(within(await screen.findByRole('region', { name: 'Bean' })).getByText('Elto Arbegona')).toBeInTheDocument()
  })

  it('opens on the bean you came from on its page', async () => {
    renderApp('/brew?bag=bag-b-elto', { mock: { bags: [elto, geisha] } })
    const bean = await screen.findByRole('region', { name: 'Bean' })
    expect(within(bean).getByText('Elto Arbegona')).toBeInTheDocument()
  })

  it('offers V60 now and the other methods as coming soon', async () => {
    renderApp('/brew', { mock: { bags: [geisha], profile: { default_method: 'espresso' } } })
    const method = await screen.findByRole('group', { name: 'Brew method' })
    expect(within(method).getByRole('button', { name: 'V60' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(method).getByRole('button', { name: /AeroPress/ })).toBeDisabled()
    expect(within(method).getByRole('button', { name: /Espresso/ })).toBeDisabled()
    expect(await screen.findByText(/Your default method \(Espresso\) isn't available yet/)).toBeInTheDocument()
  })

  it('always shows the goal slider with what it is set to', async () => {
    renderApp('/brew', { mock: { bags: [geisha] } })
    const slider = await screen.findByRole('slider', { name: 'Sweeter or more acidity' })
    expect(slider).toHaveValue('0')
    expect(screen.getByText('Balanced')).toBeInTheDocument()

    fireEvent.change(slider, { target: { value: '0.6' } })
    expect(await screen.findByText('60% more acidity')).toBeInTheDocument()
    fireEvent.change(slider, { target: { value: '-0.3' } })
    expect(await screen.findByText('30% sweeter')).toBeInTheDocument()
  })

  it('never calls the goal "brighter" on screen', async () => {
    renderApp('/brew', { mock: { bags: [geisha] } })
    await screen.findByRole('slider', { name: 'Sweeter or more acidity' })
    expect(screen.queryByText(/brighter/i)).not.toBeInTheDocument()
  })

  it('picks a strength', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [geisha] } })
    const strength = await screen.findByRole('radiogroup', { name: 'Strength' })
    expect(within(strength).getByRole('radio', { name: 'Medium' })).toBeChecked()
    await user.click(within(strength).getByRole('radio', { name: 'Strong' }))
    expect(within(strength).getByRole('radio', { name: 'Strong' })).toBeChecked()
  })

  it('does not offer tasting notes to bring out: they do not change the cup', async () => {
    renderApp('/brew', { mock: { bags: [geisha] } })
    await screen.findByRole('region', { name: 'Bean' })
    expect(screen.queryByRole('region', { name: 'Bring out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'vanilla' })).not.toBeInTheDocument()
  })

  it('asks for a grinder inline and adds it', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [geisha] } })
    const gear = await screen.findByRole('region', { name: 'Your gear' })
    await user.click(within(gear).getByRole('button', { name: 'Add your grinder' }))
    await user.click(await screen.findByRole('button', { name: /Turin DF54/ }))
    expect(await within(await screen.findByRole('region', { name: 'Your gear' })).findByRole('button', { name: /Grinder/ })).toHaveTextContent('Turin DF54')
  })

  it('shows your grinder and default filter', async () => {
    renderApp('/brew', { mock: { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'] } })
    const gear = await screen.findByRole('region', { name: 'Your gear' })
    expect(await within(gear).findByRole('button', { name: /Grinder/ })).toHaveTextContent('Turin DF54')
    expect(within(gear).getByRole('button', { name: /Filter/ })).toHaveTextContent('CAFEC T-90')
  })

  it('goes to the recipe for what you chose', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [geisha] } })
    fireEvent.change(await screen.findByRole('slider', { name: 'Sweeter or more acidity' }), { target: { value: '0.6' } })
    await user.click(screen.getByRole('link', { name: 'Suggest a recipe' }))
    expect(await screen.findByRole('heading', { name: 'Tanzania Geisha' })).toBeInTheDocument()
    expect(screen.getByText(/V60 · more acidity, medium/)).toBeInTheDocument()
  })
})

describe('Brew: the recipe', () => {
  const at = (query = '') => `/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2${query}`
  const mock = { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'] }

  it('shows the recipe, its confidence and the filter', async () => {
    renderApp(at(), { mock })
    expect(await screen.findByRole('heading', { name: 'Tanzania Geisha' })).toBeInTheDocument()
    const specs = screen.getByLabelText('Recipe')
    expect(within(specs).getByText('Coffee').nextSibling).toHaveTextContent('20 g')
    expect(within(specs).getByText('Water').nextSibling).toHaveTextContent('300 g')
    expect(within(specs).getByText('Ratio').nextSibling).toHaveTextContent('1:15')
    expect(within(specs).getByText('Water temp').nextSibling).toHaveTextContent('95°C')
    expect(within(specs).getByText('Filter').nextSibling).toHaveTextContent('T-90')
    expect(screen.getByRole('button', { name: /Starting point · expect 2–3 brews/ })).toBeInTheDocument()
  })

  it('lists the pours with their amounts and the running total', async () => {
    renderApp(at(), { mock })
    const pours = await screen.findByRole('region', { name: 'Pours' })
    const rows = within(pours).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('0:00')
    expect(rows[0]).toHaveTextContent('+60 g')
    expect(rows[4]).toHaveTextContent('300 g')
  })

  it('rescales for the number of cups', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    const cups = await screen.findByRole('radiogroup', { name: 'Cups' })
    await user.click(within(cups).getByRole('radio', { name: '1' }))
    const specs = await screen.findByLabelText('Recipe')
    expect(within(specs).getByText('Coffee').nextSibling).toHaveTextContent('10 g')
    expect(within(specs).getByText('Water').nextSibling).toHaveTextContent('150 g')
  })

  it('shows the grind in your grinder\'s units', async () => {
    renderApp(at(), { mock })
    const grind = await screen.findByRole('region', { name: 'Grind' })
    expect(within(grind).getByText(/Turin DF54/)).toBeInTheDocument()
    expect(within(grind).getByText('77')).toBeInTheDocument()
    expect(within(grind).getByText('dial')).toBeInTheDocument()
    expect(within(grind).getByText(/About 790 µm/)).toBeInTheDocument()
  })

  it('says when the grind is a rough estimate', async () => {
    renderApp(at(), { mock: { ...mock, grinderIds: ['kingrinder-k7'] } })
    const grind = await screen.findByRole('region', { name: 'Grind' })
    expect(within(grind).getByText('Rough estimate')).toBeInTheDocument()
  })

  it('shows microns and an invitation when there is no grinder', async () => {
    renderApp(at(), { mock: { ...mock, grinderIds: [] } })
    const grind = await screen.findByRole('region', { name: 'Grind' })
    expect(within(grind).getByText('790')).toBeInTheDocument()
    expect(within(grind).getByText('µm')).toBeInTheDocument()
    expect(within(grind).getByRole('link', { name: 'Add your grinder to see clicks' })).toHaveAttribute('href', '/profile')
  })

  it('does not pretend to convert for a grinder we have no data for', async () => {
    renderApp(at(), { mock: { ...mock, grinderIds: ['lopder-maxa'] } })
    const grind = await screen.findByRole('region', { name: 'Grind' })
    expect(within(grind).getByText(/can't convert to Lopder MAXA yet/)).toBeInTheDocument()
  })

  it('uses your temperature unit', async () => {
    renderApp(at(), { mock: { ...mock, profile: { temp_unit: 'f' } } })
    const specs = await screen.findByLabelText('Recipe')
    expect(await within(specs).findByText('203°F')).toBeInTheDocument()
  })

  it('ignores tasting notes in older links, so the pours do not move', async () => {
    renderApp(at('&notes=vanilla'), { mock })
    const pours = await screen.findByRole('region', { name: 'Pours' })
    expect(within(pours).getAllByRole('listitem')[0]).toHaveTextContent('+60 g')
  })

  it('leans the first pour with the goal: brighter is bigger, sweeter is smaller', async () => {
    renderApp('/brew/recipe?bag=bag-b-geisha&balance=0.6&strength=medium&cups=2', { mock })
    const brighter = await screen.findByRole('region', { name: 'Pours' })
    expect(within(brighter).getAllByRole('listitem')[0]).toHaveTextContent('+72 g')
  })

  it('explains itself', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: 'Why these numbers' }))
    expect(await screen.findByText(/4:6 method: the first 40%/)).toBeInTheDocument()
    expect(screen.getAllByText('From the 4:6 method').length).toBeGreaterThan(0)
    expect(screen.getByText(/No recipes for this bean or similar ones yet/)).toBeInTheDocument()
  })

  it('handles a bean that is not in your beans', async () => {
    renderApp('/brew/recipe?bag=nope', { mock })
    expect(await screen.findByRole('heading', { name: 'Bean not found' })).toBeInTheDocument()
  })

  it('goes back to set up with your choices intact', async () => {
    const user = userEvent.setup()
    renderApp('/brew/recipe?bag=bag-b-geisha&balance=0.6&strength=strong&cups=2', { mock })
    await screen.findByRole('heading', { name: 'Tanzania Geisha' }) // the link also exists while loading
    await user.click(screen.getByRole('link', { name: 'Back to set up' }))
    const strength = await screen.findByRole('radiogroup', { name: 'Strength' })
    expect(within(strength).getByRole('radio', { name: 'Strong' })).toBeChecked()
    expect(await screen.findByRole('slider', { name: 'Sweeter or more acidity' })).toHaveValue('0.6')
  })
})

describe('Brew: editing the recipe', () => {
  const at = (query = '') => `/brew/recipe?bag=bag-b-geisha&balance=0&strength=medium&cups=2${query}`
  const mock = { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'] }
  const spec = (label: string) => within(screen.getByLabelText('Recipe')).getByText(label).nextSibling

  it('changes the coffee and lets the water follow the ratio', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Coffee: 20 g/ }))
    const input = await screen.findByRole('spinbutton', { name: /^Coffee/ })
    await user.clear(input)
    await user.type(input, '15')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(spec('Coffee')).toHaveTextContent('15 g')
    expect(spec('Water')).toHaveTextContent('225 g')
    expect(spec('Ratio')).toHaveTextContent('1:15')
    expect(screen.getByRole('button', { name: /^Coffee: 15 g, set by you/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your edits · started from a suggestion/ })).toBeInTheDocument()
  })

  it('can keep the water when the coffee changes', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Coffee: 20 g/ }))
    await user.click(await screen.findByRole('radio', { name: 'Stays' }))
    const input = screen.getByRole('spinbutton', { name: /^Coffee/ })
    await user.clear(input)
    await user.type(input, '15')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(spec('Water')).toHaveTextContent('300 g')
    expect(spec('Ratio')).toHaveTextContent('1:20')
  })

  it('steps the coffee a gram at a time next to the cups shortcut, which clears it again', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: 'Less coffee' }))
    expect(spec('Coffee')).toHaveTextContent('19 g')
    expect(within(screen.getByRole('radiogroup', { name: 'Cups' })).queryByRole('radio', { checked: true })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('radiogroup', { name: 'Cups' })).getByRole('radio', { name: '2' }))
    expect(spec('Coffee')).toHaveTextContent('20 g')
  })

  it('edits temperature, and puts one value back', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Water temp/ }))
    const input = await screen.findByRole('spinbutton', { name: /^Water temp/ })
    await user.clear(input)
    await user.type(input, '90')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(spec('Water temp')).toHaveTextContent('90°C')
    await user.click(screen.getByRole('button', { name: /^Water temp/ }))
    await user.click(await screen.findByRole('button', { name: 'Back to the suggestion' }))
    expect(spec('Water temp')).toHaveTextContent('95°C')
  })

  it('refuses a number outside the limits', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Coffee: 20 g/ }))
    const input = await screen.findByRole('spinbutton', { name: /^Coffee/ })
    await user.clear(input)
    await user.type(input, '400')
    expect(screen.getByRole('alert')).toHaveTextContent('Use a number from 5 to 60.')
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  })

  it('edits each pour, and the last one is the water', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: 'Edit pours' }))
    const last = await screen.findByLabelText('Pour 5 total water')
    await user.clear(last)
    await user.type(last, '280')
    await user.click(screen.getByRole('button', { name: 'Remove pour 3' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    const rows = within(screen.getByRole('region', { name: 'Pours' })).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toHaveTextContent('280 g')
    expect(spec('Water')).toHaveTextContent('280 g')
    expect(screen.getByText('Pours · yours')).toBeInTheDocument()
  })

  it('does not accept pours that go backwards', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: 'Edit pours' }))
    const second = await screen.findByLabelText('Pour 2 total water')
    await user.clear(second)
    await user.type(second, '10')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  })

  it('resets everything to the suggestion', async () => {
    const user = userEvent.setup()
    renderApp(at('&temp=88&dose=18'), { mock })
    expect(await screen.findByLabelText('Recipe')).toBeInTheDocument()
    expect(spec('Coffee')).toHaveTextContent('18 g')
    await user.click(screen.getByRole('button', { name: 'Reset all to the suggestion' }))
    expect(spec('Coffee')).toHaveTextContent('20 g')
    expect(spec('Water temp')).toHaveTextContent('95°C')
    expect(screen.queryByRole('button', { name: 'Reset all to the suggestion' })).not.toBeInTheDocument()
  })
})

