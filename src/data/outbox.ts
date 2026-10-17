import type { Api, LockRecipeInput, SaveDraftInput } from './types'

/**
 * Writes that could not reach the server wait here, on the phone, and are sent when the
 * connection is back. Both writes are safe to repeat: a draft overwrites itself and a lock is
 * keyed by its brew id.
 */
export type OutboxEntry = { key: string; kind: 'draft'; input: SaveDraftInput } | { key: string; kind: 'lock'; input: LockRecipeInput }

const STORAGE_KEY = 'barista.outbox'

export function readOutbox(): OutboxEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : []
  } catch {
    return []
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked: the write is lost, which is no worse than before.
  }
}

/** True when the failure is a dropped connection, not the server refusing the write. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /failed to fetch|networkerror|load failed|network request failed|typeerror/i.test(message)
}

export const draftKey = (input: SaveDraftInput) => `draft:${input.beanId}:${input.method}`

export function enqueue(entry: OutboxEntry): void {
  const entries = readOutbox()
  const at = entries.findIndex((e) => e.key === entry.key)
  if (at < 0) return writeOutbox([...entries, entry])
  const old = entries[at]!
  // A newer draft replaces an older one but keeps the last brew result if it has none of its own.
  if (old.kind === 'draft' && entry.kind === 'draft' && !entry.input.lastBrew && old.input.lastBrew) {
    entry = { ...entry, input: { ...entry.input, lastBrew: old.input.lastBrew } }
  }
  entries[at] = entry
  writeOutbox(entries)
}

export const pendingCount = (): number => readOutbox().length

/** Sends what is waiting, oldest first. Stops at the first dropped connection. Returns how many went through. */
export async function flushOutbox(api: Api): Promise<number> {
  let sent = 0
  for (const entry of readOutbox()) {
    try {
      if (entry.kind === 'draft') await api.saveDraft(entry.input)
      else await api.lockRecipe(entry.input)
    } catch (error) {
      if (isNetworkError(error)) break
      // The server refused it for good (for example the bag was removed): drop it, it will never work.
    }
    writeOutbox(readOutbox().filter((e) => e.key !== entry.key))
    sent += 1
  }
  return sent
}
