/** What a typed search means once we know which roasters exist in the catalogue. */
export type Prefill = { roaster?: string; name?: string }

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * If the typed text is, or starts with, a roaster we already know, split it into
 * roaster and the rest (the bean name). Longest roaster wins. Returns null when the
 * text does not clearly contain a known roaster, so the caller can ask instead of guessing.
 */
export function splitKnownRoaster(typed: string, roasters: string[]): Prefill | null {
  const words = typed.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  const byKey = new Map<string, string>()
  for (const roaster of roasters) byKey.set(key(roaster), roaster)

  for (let count = words.length; count >= 1; count--) {
    const known = byKey.get(key(words.slice(0, count).join(' ')))
    if (known) {
      const rest = words.slice(count).join(' ')
      return rest ? { roaster: known, name: rest } : { roaster: known }
    }
  }
  return null
}

/** Distinct roasters, in a stable order, for suggestions. */
export function uniqueRoasters(roasters: string[]): string[] {
  const seen = new Map<string, string>()
  for (const roaster of roasters) if (!seen.has(key(roaster))) seen.set(key(roaster), roaster.trim())
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
