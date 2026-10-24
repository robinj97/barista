import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeBag, renderApp } from '../test/renderApp'

const elto = makeBag('b-elto', { createdAt: '2026-10-10T10:00:00Z' })
const geisha = makeBag('b-geisha', { createdAt: '2026-10-14T10:00:00Z' })

/** The pours are on their own view of the recipe screen. */
async function showPours() {
  await userEvent.click(await screen.findByRole('radio', { name: 'Pours' }))
  return screen.getByRole('region', { name: 'Pours' })
}

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

  it('always shows the goal slider with presets and what it is set to', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [geisha] } })
    const slider = await screen.findByRole('slider', { name: 'Sweeter or more acidity' })
    expect(slider).toHaveValue('0')
    expect(screen.getByRole('radio', { name: 'Balanced' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'More acidity' }))
    expect(slider).toHaveValue('0.6')
    expect(screen.getByText('60% more acidity')).toBeInTheDocument()

    fireEvent.change(slider, { target: { value: '0.6' } })
    expect(await screen.findByText('60% more acidity')).toBeInTheDocument()
    fireEvent.change(slider, { target: { value: '-0.3' } })
    expect(await screen.findByText('30% sweeter')).toBeInTheDocument()
    expect(within(screen.getByRole('radiogroup', { name: 'Goal' })).queryByRole('radio', { checked: true })).not.toBeInTheDocument()
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
    expect(await within(await screen.findByRole('region', { name: 'Your gear' })).findByRole('button', { name: /Edit your gear/ })).toHaveTextContent('Turin DF54')
  })

  it('shows your grinder and default filter on one slim line', async () => {
    renderApp('/brew', { mock: { bags: [geisha], grinderIds: ['turin-df54'], filterIds: ['f-cafec-t90'] } })
    const gear = await screen.findByRole('region', { name: 'Your gear' })
    expect(await within(gear).findByRole('button', { name: /Edit your gear/ })).toHaveTextContent('Turin DF54 · CAFEC T-90')
  })

  it('goes to the recipe for what you chose', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock: { bags: [geisha] } })
    await user.click(await screen.findByRole('radio', { name: 'More acidity' }))
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
    const pours = await showPours()
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
    const pours = await showPours()
    expect(within(pours).getAllByRole('listitem')[0]).toHaveTextContent('+60 g')
  })

  it('leans the first pour with the goal: brighter is bigger, sweeter is smaller', async () => {
    renderApp('/brew/recipe?bag=bag-b-geisha&balance=0.6&strength=medium&cups=2', { mock })
    const brighter = await showPours()
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

  it('calculates the coffee from a target water amount and the ratio you see', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Water: 300 g/ }))
    await user.click(await screen.findByRole('radio', { name: 'Ratio' }))
    const input = screen.getByRole('spinbutton', { name: /^Water/ })
    await user.clear(input)
    await user.type(input, '450')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(spec('Water')).toHaveTextContent('450 g')
    expect(spec('Coffee')).toHaveTextContent('30 g')
    expect(spec('Ratio')).toHaveTextContent('1:15')
  })

  it('calculates the coffee from a ratio with the water kept', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Ratio: 1:15/ }))
    await user.click(await screen.findByRole('radio', { name: 'Water' }))
    const input = screen.getByRole('spinbutton', { name: /^Ratio/ })
    await user.clear(input)
    await user.type(input, '16')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(spec('Water')).toHaveTextContent('300 g')
    expect(spec('Coffee')).toHaveTextContent('18.8 g')
  })

  it('refuses a target that would need an impossible amount of coffee', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await user.click(await screen.findByRole('button', { name: /^Water: 300 g/ }))
    await user.click(await screen.findByRole('radio', { name: 'Ratio' }))
    const input = screen.getByRole('spinbutton', { name: /^Water/ })
    await user.clear(input)
    await user.type(input, '1200')
    expect(screen.getByRole('alert')).toHaveTextContent('That needs 80 g of coffee')
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
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
    await showPours()
    await user.click(screen.getByRole('button', { name: 'Edit pours' }))
    const last = await screen.findByLabelText('Pour 5 total water')
    await user.clear(last)
    await user.type(last, '280')
    await user.click(screen.getByRole('button', { name: 'Remove pour 3' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    const rows = within(screen.getByRole('region', { name: 'Pours' })).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toHaveTextContent('280 g')
    expect(screen.getByText('Pours · yours')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Recipe' }))
    expect(spec('Water')).toHaveTextContent('280 g')
  })

  it('does not accept pours that go backwards', async () => {
    const user = userEvent.setup()
    renderApp(at(), { mock })
    await showPours()
    await user.click(screen.getByRole('button', { name: 'Edit pours' }))
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


describe('Brew: the gear line', () => {
  const mock = { bags: [geisha], grinderIds: ['turin-df54', 'kingrinder-k7'], filterIds: ['f-cafec-t90'] }
  const line = async () => within(await screen.findByRole('region', { name: 'Your gear' })).findByRole('button', { name: /Edit your gear/ })

  it('is one short line, not two big rows', async () => {
    renderApp('/brew', { mock })
    expect(await line()).toHaveTextContent('Gear')
    expect(screen.queryByRole('button', { name: /^Grinder/ })).not.toBeInTheDocument()
  })

  it('says No filter when you have none selected', async () => {
    renderApp('/brew', { mock: { ...mock, filterIds: [] } })
    expect(await line()).toHaveTextContent('· No filter')
  })

  it('opens the lists, shows what each grinder is good for, and picks one', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock })
    await user.click(await line())
    const grinders = await screen.findByRole('radiogroup', { name: 'Grinder' })
    // Your grinders are listed alphabetically; the first is chosen until you pick another.
    expect(within(grinders).getByRole('radio', { name: /Kingrinder K7/ })).toBeChecked()
    expect(within(grinders).getByRole('radio', { name: /Kingrinder K7/ })).toHaveTextContent('Rough estimate')
    await user.click(within(grinders).getByRole('radio', { name: /Turin DF54/ }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await line()).toHaveTextContent('Turin DF54')
  })

  it('can switch the filter off', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock })
    await user.click(await line())
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Filter' })).getByRole('radio', { name: 'No filter' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await line()).toHaveTextContent('· No filter')
  })

  it('carries what you picked to the recipe', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock })
    await user.click(await line())
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Grinder' })).getByRole('radio', { name: /Turin DF54/ }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('link', { name: 'Suggest a recipe' }))
    expect(await within(await screen.findByRole('region', { name: 'Grind' })).findByText(/Turin DF54/)).toBeInTheDocument()
  })

  it('lets you add a filter from the sheet', async () => {
    const user = userEvent.setup()
    renderApp('/brew', { mock })
    await user.click(await line())
    await user.click(await screen.findByRole('button', { name: 'Add a filter' }))
    expect(await screen.findByLabelText('Search filters')).toBeInTheDocument()
  })

  describe('going back from a dialed-in recipe to change the goal', () => {
    const dialed = '/brew/recipe?bag=bag-b-geisha&balance=-0.3&strength=medium&cups=2&dose=16.9&water=270&temp=92&grind=711'
    const link = () => new URL(screen.getByRole('link', { name: 'Suggest a recipe' }).getAttribute('href')!, 'http://x').searchParams

    it('keeps grind, temperature, coffee and water when you make it sweeter', async () => {
      const user = userEvent.setup()
      renderApp(dialed, { mock: { bags: [geisha] } })
      await screen.findByLabelText('Recipe')
      await user.click(screen.getByRole('link', { name: 'Back to set up' }))
      await user.click(await screen.findByRole('radio', { name: 'Sweeter' }))
      const params = link()
      expect(params.get('balance')).not.toBe('-0.3')
      expect([params.get('grind'), params.get('temp'), params.get('dose'), params.get('water')]).toEqual(['711', '92', '16.9', '270'])
    })

    it('makes sweetness count with your own pours, keeping their times and the water', async () => {
      const user = userEvent.setup()
      renderApp(`${dialed}&pours=0:54,50:108,95:162,140:216,180:270`, { mock: { bags: [geisha] } })
      await screen.findByLabelText('Recipe')
      await user.click(screen.getByRole('link', { name: 'Back to set up' }))
      await user.click(await screen.findByRole('radio', { name: 'Sweeter' }))
      const pours = link().get('pours')!.split(',').map((p) => p.split(':').map(Number))
      expect(pours.map(([atS]) => atS)).toEqual([0, 50, 95, 140, 180])
      expect(pours.at(-1)![1]).toBe(270)
      expect(pours[0]![1]).toBeLessThan(54)
      expect(link().get('grind')).toBe('711')
    })
  })

  describe('starting from where you left off on a bean', () => {
    const working = {
      beanId: 'b-geisha', method: 'v60' as const, updatedAt: '2026-10-24T08:00:00Z', lastBrew: null,
      choices: { bagId: 'bag-b-geisha', balance: -0.3, strength: 'medium' as const, grinderId: null, filterId: null, cups: 2, edits: { doseG: 15, ratio: 16, tempC: 92, grindUm: 729 } },
    }
    const link = async () => {
      await waitFor(() => expect(screen.getByRole('link', { name: 'Suggest a recipe' }).getAttribute('href')).toContain('grind='))
      return new URL(screen.getByRole('link', { name: 'Suggest a recipe' }).getAttribute('href')!, 'http://x').searchParams
    }

    it('from the bean page, set-up starts from the working recipe, and sweeter keeps its grind and temperature', async () => {
      const user = userEvent.setup()
      renderApp('/brew?bag=bag-b-geisha', { mock: { bags: [geisha], drafts: [working] } })
      expect(Object.fromEntries((await link()).entries())).toMatchObject({ balance: '-0.3', grind: '729', temp: '92', dose: '15', ratio: '16' })
      await user.click(screen.getByRole('radio', { name: 'Sweeter' }))
      expect(Object.fromEntries((await link()).entries())).toMatchObject({ balance: '-0.6', grind: '729', temp: '92', dose: '15', ratio: '16' })
    })

    it('from the Brew tab, the last bean you brewed comes back as you left it', async () => {
      renderApp('/brew', { mock: { bags: [elto, geisha], drafts: [working] } })
      expect((await link()).get('grind')).toBe('729')
    })

    it('keeps a reset: with choices already in the address, nothing is brought back', async () => {
      renderApp('/brew?bag=bag-b-geisha&balance=0&strength=medium&cups=2', { mock: { bags: [geisha], drafts: [working] } })
      await screen.findByRole('link', { name: 'Suggest a recipe' })
      expect(screen.getByRole('link', { name: 'Suggest a recipe' }).getAttribute('href')).not.toContain('grind=')
    })
  })
})

