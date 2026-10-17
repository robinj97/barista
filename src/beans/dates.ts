/** Local calendar dates as yyyy-mm-dd strings (what a date input and the database expect). */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function daysAgo(days: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days)
  return toISODate(date)
}

export function daysSince(iso: string, from: Date = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((today.getTime() - parseISODate(iso).getTime()) / 86_400_000)
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", or null when the roast date is unknown. */
export function roastAge(iso: string | null, from: Date = new Date()): string | null {
  if (!iso) return null
  const days = daysSince(iso, from)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  return `${Math.round(days / 30)} months ago`
}

/** "Roasted 5 days ago" and so on, or null when the roast date is unknown. */
export function roastedLabel(iso: string | null, from: Date = new Date()): string | null {
  const age = roastAge(iso, from)
  return age ? `Roasted ${age}` : null
}

/**
 * dd/mm/yyyy text entry. The browser's own date input follows the device locale and cannot be
 * forced to day-first, so the roast date is typed (or tapped in) as plain digits instead.
 */

/** Keeps digits only and inserts the slashes as you type: "05102026" -> "05/10/2026". */
export function maskDMY(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean)
  return parts.join('/')
}

/** "05/10/2026" -> "2026-10-05", or null unless it is a real calendar date (leap years included). */
export function parseDMY(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return toISODate(date)
}

/** "2026-10-05" -> "05/10/2026". */
export function formatDMY(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
