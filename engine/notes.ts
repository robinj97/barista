import { roundDp } from './math.ts'
import { normalise } from './traits.ts'

/**
 * Which way a tasting note pulls the balance. A hand-written lookup (guidance, not science):
 * bright notes (citrus, florals, tea, sharp fruit) lean towards a bigger first pour; sweet
 * notes (chocolate, caramel, nuts, honey) lean towards a smaller one.
 */
const BRIGHT = [
  'bergamot', 'tangerine', 'orange', 'lemon', 'lime', 'grapefruit', 'citrus', 'apple', 'pineapple',
  'passion fruit', 'currant', 'raspberry', 'cherry', 'hibiscus', 'jasmine', 'rose', 'lavender',
  'floral', 'tropical', 'green tea', 'black tea', 'berry', 'berries', 'cherries', 'red fruit',
]
const SWEET = [
  'honey', 'caramel', 'brown sugar', 'molasses', 'vanilla', 'chocolate', 'cocoa', 'nut', 'almond',
  'cinnamon', 'spice', 'peach', 'apricot', 'plum', 'stone fruit',
]

/** Endings that keep a word's meaning: "oranges", "lemony", "nutty", "honeyed", "caramelised". */
const SUFFIXES = ['s', 'es', 'y', 'ey', 'ty', 'ed', 'ised', 'ized', 'ish']

/** "blueberry" and "hazelnut" end with a known note; "oranges" and "nutty" start with one. */
const isFormOf = (word: string, known: string) =>
  word.endsWith(known) || (word.startsWith(known) && SUFFIXES.includes(word.slice(known.length)))

export type NoteCharacter = 'bright' | 'sweet' | 'neutral'

/**
 * A note leans bright or sweet if it contains a known phrase ("black tea") or a word that is a
 * form of a known note ("candied lemon", "milk chocolate", "blueberry"). Notes leaning both ways
 * ("chocolate orange") cancel out to neutral.
 */
export function noteCharacter(note: string): NoteCharacter {
  const phrase = normalise(note)
  const words = phrase.split(' ')
  const leans = (list: string[]) =>
    list.some((known) => (known.includes(' ') ? phrase.includes(known) : words.some((word) => isFormOf(word, known))))
  const bright = leans(BRIGHT)
  const sweet = leans(SWEET)
  if (bright === sweet) return 'neutral'
  return bright ? 'bright' : 'sweet'
}

/** Largest push the notes can give the balance. The user's own dial stays in charge. */
const MAX_NUDGE = 0.35

export function noteNudge(emphasise: string[]): { nudge: number; bright: string[]; sweet: string[] } {
  const bright = emphasise.filter((note) => noteCharacter(note) === 'bright')
  const sweet = emphasise.filter((note) => noteCharacter(note) === 'sweet')
  const counted = bright.length + sweet.length
  const lean = counted === 0 ? 0 : (bright.length - sweet.length) / counted // +1 all bright, -1 all sweet
  return { nudge: roundDp(lean * MAX_NUDGE, 2), bright, sweet }
}
