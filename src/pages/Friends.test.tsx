import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { rememberDestination, takeDestination } from '../auth/afterSignIn'
import { renderApp } from '../test/renderApp'

const soon = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()

describe('Friends', () => {
  it('is a tab', async () => {
    renderApp('/beans')
    expect(await screen.findByRole('link', { name: 'Friends' })).toHaveAttribute('href', '/friends')
  })

  it('says what it is for when you have no friends', async () => {
    renderApp('/friends')
    expect(await screen.findByText(/No friends yet/)).toBeInTheDocument()
  })

  it('lists your friends', async () => {
    renderApp('/friends', { mock: { friends: [{ id: 'f1', name: 'Sam', avatarUrl: null, since: '2026-10-10T10:00:00Z' }, { id: 'f2', name: 'Ava', avatarUrl: null, since: '2026-10-12T10:00:00Z' }] } })
    const section = await screen.findByRole('region', { name: 'Your friends' })
    const rows = within(section).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Ava')
    expect(rows[1]).toHaveTextContent('Sam')
    expect(rows[1]).toHaveTextContent('Friends since 10/10/2026')
  })

  it('makes an invite link and shows it once, with copy', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderApp('/friends')
    await user.click(await screen.findByRole('button', { name: 'Invite a friend' }))
    const input = await screen.findByLabelText('Invite link')
    expect(input).toHaveValue(`${window.location.origin}/invite/token-1`)
    expect(screen.getByText(/works once and for 7 days/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/token-1`)
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
  })

  it('lists invites that are still open, and lets you cancel one', async () => {
    const user = userEvent.setup()
    renderApp('/friends', { mock: { invites: [{ id: 'h1', expiresAt: soon(3) }] } })
    const section = await screen.findByRole('region', { name: 'Pending invites' })
    expect(section).toHaveTextContent('expires in 3 days')
    await user.click(within(section).getByRole('button', { name: /Cancel/ }))
    expect(screen.queryByRole('region', { name: 'Pending invites' })).not.toBeInTheDocument()
  })

  it('shows the new invite in the pending list afterwards', async () => {
    const user = userEvent.setup()
    renderApp('/friends')
    await user.click(await screen.findByRole('button', { name: 'Invite a friend' }))
    await screen.findByLabelText('Invite link')
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('region', { name: 'Pending invites' })).toHaveTextContent('expires in 7 days')
  })
})

describe('An invite link', () => {
  const mock = { incomingInvites: { good: { displayName: 'Sam', avatarUrl: null } } }

  it('says who it is from and lets you accept', async () => {
    const user = userEvent.setup()
    renderApp('/invite/good', { mock })
    expect(await screen.findByRole('heading', { name: 'Sam invited you to be friends' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(await screen.findByRole('heading', { name: 'You and Sam are friends' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'See your friends' }))
    const section = await screen.findByRole('region', { name: 'Your friends' })
    expect(within(section).getByText('Sam')).toBeInTheDocument()
  })

  it('can be left alone', async () => {
    const user = userEvent.setup()
    renderApp('/invite/good', { mock })
    await user.click(await screen.findByRole('link', { name: 'Not now' }))
    expect(await screen.findByRole('heading', { name: 'Beans' })).toBeInTheDocument()
  })

  it('fails the same way for any bad link', async () => {
    renderApp('/invite/nonsense', { mock })
    expect(await screen.findByRole('heading', { name: "This invite doesn't work" })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
  })
})

describe('Signing in on the way to a link', () => {
  it('remembers where a signed-out visitor was heading, once', () => {
    window.history.pushState({}, '', '/invite/abc')
    rememberDestination()
    expect(takeDestination()).toBe('/invite/abc')
    expect(takeDestination()).toBeNull()
    window.history.pushState({}, '', '/')
  })

  it('does not remember the home page', () => {
    window.history.pushState({}, '', '/')
    rememberDestination()
    expect(takeDestination()).toBeNull()
  })

  it('carries on to the remembered page after signing in', async () => {
    localStorage.setItem('barista.after-sign-in', '/friends')
    renderApp('/beans')
    expect(await screen.findByRole('heading', { name: 'Friends' })).toBeInTheDocument()
  })
})
