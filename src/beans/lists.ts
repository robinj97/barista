/** Suggestions for the add-bean form. Free text is always allowed. */

export const ORIGINS = [
  'Blend', 'Bolivia', 'Brazil', 'Burundi', 'China', 'Colombia', 'Costa Rica', 'Cuba',
  'Democratic Republic of the Congo', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Ethiopia',
  'Guatemala', 'Haiti', 'Honduras', 'India', 'Indonesia', 'Jamaica', 'Kenya', 'Laos', 'Malawi',
  'Mexico', 'Myanmar', 'Nepal', 'Nicaragua', 'Panama', 'Papua New Guinea', 'Peru', 'Philippines',
  'Rwanda', 'Tanzania', 'Thailand', 'Timor-Leste', 'Uganda', 'USA (Hawaii)', 'Venezuela', 'Vietnam',
  'Yemen', 'Zambia', 'Zimbabwe',
]

/** Processes that can be combined: "Anaerobic washed", "Anaerobic natural". Anything else goes in as free text. */
export const PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic'] as const
export type Process = (typeof PROCESSES)[number]

/** One process string from the chips and the free text, e.g. "Anaerobic washed" or "Washed, thermal shock". Anaerobic leads, as it describes how the rest was done. */
export function composeProcess(chips: Process[], other = ''): string {
  const ordered = [...chips].sort((a, b) => Number(b === 'Anaerobic') - Number(a === 'Anaerobic') || PROCESSES.indexOf(a) - PROCESSES.indexOf(b))
  const phrase = ordered.map((chip, i) => (i === 0 ? chip : chip.toLowerCase())).join(' ')
  return [phrase, other.trim()].filter(Boolean).join(', ')
}

/** The reverse, for showing a saved process again: the chips it is made of, and what is left over as free text. */
export function parseProcess(text: string | null | undefined): { chips: Process[]; other: string } {
  const value = (text ?? '').trim()
  if (!value) return { chips: [], other: '' }
  const [first = '', ...rest] = value.split(', ')
  const words = first.toLowerCase().split(' ')
  const chips = PROCESSES.filter((p) => words.includes(p.toLowerCase()))
  if (chips.length === words.length) return { chips, other: rest.join(', ') }
  return { chips: [], other: value }
}

export const FLAVOURS = [
  'bergamot', 'tangerine', 'orange', 'lemon', 'lime', 'grapefruit', 'peach', 'apricot', 'plum',
  'cherry', 'apple', 'pear', 'pineapple', 'mango', 'passion fruit', 'blueberry', 'strawberry',
  'raspberry', 'blackcurrant', 'jasmine', 'rose', 'hibiscus', 'lavender', 'honey', 'caramel',
  'brown sugar', 'molasses', 'vanilla', 'chocolate', 'cocoa', 'hazelnut', 'almond', 'black tea',
  'green tea', 'floral', 'citrus', 'stone fruit', 'berry', 'tropical', 'nutty', 'spice', 'cinnamon',
]

export const VARIETIES = [
  'Bourbon', 'Pink Bourbon', 'Yellow Bourbon', 'Caturra', 'Catuai', 'Castillo', 'Geisha', 'Heirloom',
  'Java', 'Maragogipe', 'Mundo Novo', 'Pacamara', 'Pacas', 'SL28', 'SL34', 'Sidra', 'Typica', 'Wush Wush',
]
