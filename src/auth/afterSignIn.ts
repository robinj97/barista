const KEY = 'barista.after-sign-in'

/** Remember where a signed-out visitor was heading (an invite link, say), since the sign-in round trip returns to the home page. */
export function rememberDestination(): void {
  const { pathname, search } = window.location
  if (pathname === '/' || pathname.startsWith('/auth')) return
  try {
    localStorage.setItem(KEY, pathname + search)
  } catch {
    // Without storage they just land on the home page.
  }
}

/** The remembered destination, once. */
export function takeDestination(): string | null {
  try {
    const to = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    return to && to.startsWith('/') ? to : null
  } catch {
    return null
  }
}
