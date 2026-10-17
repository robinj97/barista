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
