/**
 * Keeps one entry per coffee. Mirrors `public.bean_dedupe_key` in the database (the real rule,
 * enforced by a unique index): lower case, accents dropped, filler words dropped from the roaster,
 * then letters and digits only. "Rogue Wave" and "Rogue Wave Coffee Roasters" give the same key.
 */
const FILLER = /\b(coffee|roasters?|roastery|roasting|co|company|the)\b/g

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function dedupeKey(roaster: string, name: string): string {
  return plain(roaster).replace(FILLER, '').replace(/[^a-z0-9]/g, '') + plain(name).replace(/[^a-z0-9]/g, '')
}

const trigrams = (key: string): Set<string> => {
  const padded = `  ${key} `
  const set = new Set<string>()
  for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3))
  return set
}

/** The same measure as pg_trgm's `similarity` for a single word: shared trigrams over all trigrams. */
export function similarity(a: string, b: string): number {
  const [x, y] = [trigrams(a), trigrams(b)]
  let shared = 0
  for (const gram of x) if (y.has(gram)) shared += 1
  return shared / (x.size + y.size - shared)
}

/** From this similarity a bean is offered as "is it this one?". The database uses the same number. */
export const SIMILAR_FROM = 0.6
