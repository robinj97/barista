import { useState } from 'react'
import { dismissInstall, shouldShowInstall } from './ios'

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="inline align-text-bottom" aria-label="Share">
      <path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" />
      <path d="M7 11H6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

/** On an iPhone that has not installed the app: how to add it to the Home Screen. Dismissed for good with "Got it". */
export function InstallPrompt() {
  const [visible, setVisible] = useState(shouldShowInstall)
  if (!visible) return null

  return (
    <section aria-label="Install Barista" className="squircle mt-5 rounded-4xl bg-accent-soft px-5 py-4">
      <h2 className="font-medium">Install Barista on your iPhone</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>
          Tap the Share button <ShareIcon /> at the bottom of Safari.
        </li>
        <li>Scroll down and choose <span className="text-ink">Add to Home Screen</span>.</li>
        <li>Tap <span className="text-ink">Add</span>.</li>
      </ol>
      <p className="mt-2 text-xs text-muted">It opens full screen like an app, and your brew timer keeps running.</p>
      <button
        type="button"
        onClick={() => {
          dismissInstall()
          setVisible(false)
        }}
        className="mt-3 h-10 rounded-full bg-bg px-5 text-sm"
      >
        Got it
      </button>
    </section>
  )
}
