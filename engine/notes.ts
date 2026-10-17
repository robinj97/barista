/**
 * Which way a tasting note pulls the balance. A hand-written lookup (guidance, not science):
 * bright notes (citrus, florals, tea, sharp fruit) lean towards a bigger first pour; sweet
 * notes (chocolate, caramel, nuts, honey) lean towards a smaller one.
 */
const BRIGHT = [
  'bergamot', 'tangerine', 'orange', 'lemon', 'lime', 'grapefruit', 'citrus', 'apple', 'pineapple',
  'passion fruit', 'blackcurrant', 'raspberry', 'cherry', 'hibiscus', 'jasmine', 'rose', 'lavender',
  'floral', 'tropical', 'green tea', 'black tea', 'berry',
]
const SWEET = [
  'honey', 'caramel', 'brown sugar', 'molasses', 'vanilla', 'chocolate', 'cocoa', 'hazelnut', 'almond',
  'nutty', 'cinnamon', 'spice', 'peach', 'apricot', 'plum', 'stone fruit',
]

export type NoteCharacter = 'bright' | 'sweet' | 'neutral'

/**
 * A note leans bright or sweet if the whole phrase is known ("black tea"), or if its words
 * lean one way ("candied lemon" is bright, "milk chocolate" is sweet). Words leaning both
 * ways ("chocolate orange") cancel out to neutral.
 */
export function noteCharacter(note: string): NoteCharacter {
  const phrase = note.trim().toLowerCase().replace(/\s+/g, ' ')
  if (BRIGHT.includes(phrase)) return 'bright'
  if (SWEET.includes(phrase)) return 'sweet'

  const words = phrase.split(' ')
  const lean = (list: string[]) => words.some((word) => list.includes(word) || list.some((known) => known.includes(' ') && phrase.includes(known)))
  const bright = lean(BRIGHT)
  const sweet = lean(SWEET)
  if (bright && !sweet) return 'bright'
  if (sweet && !bright) return 'sweet'
  return 'neutral'
}

/** Largest push the notes can give the balance. The user's own dial stays in charge. */
const MAX_NUDGE = 0.35

export function noteNudge(emphasise: string[]): { nudge: number; bright: string[]; sweet: string[] } {
  const bright = emphasise.filter((note) => noteCharacter(note) === 'bright')
  const sweet = emphasise.filter((note) => noteCharacter(note) === 'sweet')
  const counted = bright.length + sweet.length
  if (counted === 0) return { nudge: 0, bright, sweet }
  const mean = (bright.length - sweet.length) / counted // +1 all bright, -1 all sweet
  return { nudge: Math.round(mean * MAX_NUDGE * 100) / 100, bright, sweet }
}
