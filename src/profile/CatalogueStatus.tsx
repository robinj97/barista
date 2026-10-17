/** What a gear picker shows before its catalogue has arrived. */
export function CatalogueStatus({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) {
    return (
      <p role="status" className="px-3 py-4 text-sm text-muted">
        Loading the list…
      </p>
    )
  }
  return (
    <p role="alert" className="px-3 py-4 text-sm text-accent">
      Couldn't load the list.{' '}
      <button type="button" onClick={onRetry} className="underline">
        Try again
      </button>
    </p>
  )
}
