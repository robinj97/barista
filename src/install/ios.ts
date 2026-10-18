const DISMISSED = 'barista.install-dismissed'

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac, with a touch screen). */
export function isIosDevice(userAgent: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)
}

/** Already opened from the Home Screen. */
export function isInstalled(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === 'yes'
  } catch {
    return false
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISSED, 'yes')
  } catch {
    // It will show again next time; not worth more.
  }
}

/** iPhones have no install button of their own: show how, once, until it is dismissed or the app is installed. */
export const shouldShowInstall = (): boolean => isIosDevice() && !isInstalled() && !installDismissed()
