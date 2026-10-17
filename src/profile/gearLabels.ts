import { isCalibrated } from '../../engine/grinder.ts'
import type { CatalogueGrinder, FilterRow } from '../data/types'

export const grinderName = (g: CatalogueGrinder) => `${g.brand} ${g.model}`

/** Plain-language note about how far we can trust conversions for this grinder, or null. */
export function grinderNote(g: CatalogueGrinder): string | null {
  if (!isCalibrated(g)) return 'Not convertible yet'
  if (g.points.some((p) => p.source === 'estimated')) return 'Rough estimate'
  return null
}

export const filterName = (f: FilterRow) => `${f.brand} ${f.model}${f.size ? ` · ${f.size}` : ''}`

export function filterNote(f: FilterRow): string {
  const parts: string[] = [f.material === 'paper' ? 'Paper' : f.material === 'metal' ? 'Metal' : 'Cloth']
  if (f.flow_class) parts.push(`${f.flow_class} flow`)
  return parts.join(' · ')
}
