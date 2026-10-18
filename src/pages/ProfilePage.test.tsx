import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { ApiContext } from '../data/ApiContext'
import type { Api } from '../data/api'
import { createMockApi, type MockOptions } from '../dev/mockApi'
import { ProfilePage } from './ProfilePage'

const session = { user: { id: 'user-1', email: 'robin@example.com', user_metadata: {} } } as unknown as Session

function setup(options: MockOptions = {}, wrap: (api: Api) => Api = (api) => api) {
  const api = wrap(createMockApi(options))
  render(
    <AuthContext.Provider
      value={{ session, loading: false, error: null, signInWithGoogle: async () => {}, signOut: async () => {} }}
    >
      <ApiContext.Provider value={api}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <ProfilePage />
          </MemoryRouter>
        </QueryClientProvider>
      </ApiContext.Provider>
    </AuthContext.Provider>,
  )
  return api
}

describe('Profile: account and defaults', () => {
  it('shows the account', async () => {
    setup()
    const account = await screen.findByRole('region', { name: 'Account' })
    expect(within(account).getByText('Robin')).toBeInTheDocument()
    expect(within(account).getByText('robin@example.com')).toBeInTheDocument()
  })

  it('edits the display name and rejects an empty one', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit name' }))
    const input = await screen.findByLabelText('Display name', { selector: 'input' })
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a name')

    await userEvent.type(input, 'Rob')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Rob')).toBeInTheDocument()
  })

  it('switches the temperature unit', async () => {
    const api = setup()
    const f = await screen.findByRole('radio', { name: '°F' })
    expect(screen.getByRole('radio', { name: '°C' })).toBeChecked()
    await userEvent.click(f)
    expect(await screen.findByRole('radio', { name: '°F', checked: true })).toBeInTheDocument()
    expect((await api.getProfile('user-1')).temp_unit).toBe('f')
  })

  it('rolls back an optimistic change when saving fails', async () => {
    setup({}, (api) => ({
      ...api,
      updateProfile: () => Promise.reject(new Error('offline')),
    }))
    await userEvent.click(await screen.findByRole('radio', { name: '°F' }))
    expect(await screen.findByRole('radio', { name: '°C', checked: true })).toBeInTheDocument()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't save")
    expect(screen.getByRole('region', { name: 'Defaults' })).toContainElement(alert)
  })

  it('changes the default method', async () => {
    const api = setup()
    await userEvent.click(await screen.findByRole('button', { name: /Default method/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'AeroPress' }))
    await screen.findByText('AeroPress')
    expect((await api.getProfile('user-1')).default_method).toBe('aeropress')
  })
})

describe('Profile: grinders', () => {
  it('invites you to add a grinder when you have none', async () => {
    setup()
    expect(await screen.findByText(/Add the grinders you use/)).toBeInTheDocument()
  })

  it('lists your grinders with a note about conversion trust', async () => {
    setup({ grinderIds: ['turin-df54', 'kingrinder-k7', 'lopder-maxa'] })
    const card = await screen.findByRole('region', { name: 'My grinders' })
    expect(await within(card).findByText('Turin DF54')).toBeInTheDocument()
    expect(within(card).getByText('Kingrinder K7').parentElement).toHaveTextContent('Rough estimate')
    expect(within(card).getByText('Lopder MAXA').parentElement).toHaveTextContent('Not convertible yet')
  })

  it('adds a grinder from the catalogue and hides it from the picker afterwards', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Add grinder' }))
    await userEvent.type(await screen.findByLabelText('Search grinders'), 'comandante')
    await userEvent.click(await screen.findByRole('button', { name: /Comandante C40/ }))
    const card = await screen.findByRole('region', { name: 'My grinders' })
    expect(await within(card).findByText('Comandante C40')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add grinder' }))
    const search = await screen.findByLabelText('Search grinders')
    expect(search).toHaveValue('')
    expect(await screen.findByRole('button', { name: /Turin DF54/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comandante C40/ })).not.toBeInTheDocument()
  })

  it('shows a retry when the catalogue fails to load', async () => {
    setup({}, (api) => ({ ...api, listGrinderCatalogue: () => Promise.reject(new Error('offline')) }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add grinder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the list")
    expect(screen.queryByText(/every grinder we list/)).not.toBeInTheDocument()
  })

  it('removes a grinder', async () => {
    setup({ grinderIds: ['turin-df54'] })
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Turin DF54' }))
    expect(await screen.findByText(/Add the grinders you use/)).toBeInTheDocument()
  })
})

describe('Profile: filters', () => {
  it('adds a filter from the catalogue; the first one becomes the default', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('button', { name: /CAFEC T-90/ }))
    const card = await screen.findByRole('region', { name: 'My filters' })
    expect(await within(card).findByText('Default')).toBeInTheDocument()
  })

  it('makes another filter the default', async () => {
    setup()
    for (const name of [/CAFEC T-90/, /Hario V60 paper/]) {
      await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
      await userEvent.click(await screen.findByRole('button', { name }))
      await screen.findByRole('button', { name: /^Remove / })
    }
    await userEvent.click(await screen.findByRole('button', { name: /Make Hario V60 paper · 02 the default/ }))
    const card = await screen.findByRole('region', { name: 'My filters' })
    const rows = within(card).getAllByRole('listitem')
    expect(await within(rows[1]!).findByText('Default')).toBeInTheDocument()
    expect(within(rows[0]!).queryByText('Default')).not.toBeInTheDocument()
  })

  it('promotes another filter when the default is removed', async () => {
    setup()
    for (const name of [/CAFEC T-90/, /Hario V60 paper/]) {
      await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
      await userEvent.click(await screen.findByRole('button', { name }))
      await screen.findByRole('button', { name: /^Remove / })
    }
    await userEvent.click(await screen.findByRole('button', { name: 'Remove CAFEC T-90 · 02' }))
    const card = await screen.findByRole('region', { name: 'My filters' })
    await within(card).findByText(/^Hario V60 paper/)
    expect(await within(card).findByText('Default')).toBeInTheDocument()
  })

  it('creates a missing filter and adds it to your list', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('button', { name: /Can't find yours/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a brand and a model')

    await userEvent.type(screen.getByLabelText('Brand'), 'Sibarist')
    await userEvent.type(screen.getByLabelText('Model'), 'Fast')
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    const card = await screen.findByRole('region', { name: 'My filters' })
    expect(await within(card).findByText('Sibarist Fast')).toBeInTheDocument()
  })

  it('does not create a duplicate when the filter already exists under another spelling', async () => {
    const api = setup()
    const before = (await api.listFilterCatalogue()).length
    await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('button', { name: /Can't find yours/ }))
    await userEvent.type(screen.getByLabelText('Brand'), 'cafec')
    await userEvent.type(screen.getByLabelText('Model'), 'T90')
    await userEvent.type(screen.getByLabelText('Size'), '02')
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    await screen.findByRole('button', { name: /^Remove / })
    expect((await api.listFilterCatalogue()).length).toBe(before)
  })

  it('keeps the default when a filter you own is entered again as new', async () => {
    const api = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('button', { name: /CAFEC T-90/ }))
    await screen.findByRole('button', { name: /^Remove / })

    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('button', { name: /Can't find yours/ }))
    await userEvent.type(screen.getByLabelText('Brand'), 'cafec')
    await userEvent.type(screen.getByLabelText('Model'), 'T90')
    await userEvent.type(screen.getByLabelText('Size'), '02')
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    await waitFor(async () => expect(await api.listMyFilters()).toEqual([expect.objectContaining({ isDefault: true })]))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts the add-filter sheet fresh after creating a filter', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('button', { name: /Can't find yours/ }))
    await userEvent.type(screen.getByLabelText('Brand'), 'Sibarist')
    await userEvent.type(screen.getByLabelText('Model'), 'Fast')
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    await screen.findByRole('button', { name: /^Remove / })

    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    expect(await screen.findByLabelText('Search filters')).toHaveValue('')
    expect(screen.queryByLabelText('Brand')).not.toBeInTheDocument()
  })
})

describe('Profile: brewing', () => {
  it('turns pour sounds on and off for this device, off by default', async () => {
    setup()
    const toggle = await screen.findByRole('switch', { name: 'Pour sounds' })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    expect(toggle).toBeChecked()
    expect(localStorage.getItem('barista.pour-sounds')).toBe('on')
    await userEvent.click(toggle)
    expect(localStorage.getItem('barista.pour-sounds')).toBe('off')
  })
})
