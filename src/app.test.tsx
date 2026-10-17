import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('app shell', () => {
  it('redirects / to the Beans tab', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Beans' })).toBeInTheDocument()
  })

  it('shows the three primary tabs', () => {
    renderAt('/beans')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toHaveTextContent('Beans')
    expect(nav).toHaveTextContent('Brew')
    expect(nav).toHaveTextContent('Library')
  })

  it('navigates between tabs', async () => {
    renderAt('/beans')
    await userEvent.click(screen.getByRole('link', { name: 'Library' }))
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })

  it('opens a bean page from the list', async () => {
    renderAt('/beans')
    await userEvent.click(screen.getByRole('link', { name: /Elto Arbegona/ }))
    expect(screen.getByRole('heading', { name: 'Elto Arbegona' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
