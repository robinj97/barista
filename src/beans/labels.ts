import type { BagStatus, RoastLevel } from '../data/types'

export const STATUS_LABELS: Record<BagStatus, string> = {
  new: 'New',
  dialing_in: 'Dialing in',
  locked: 'Locked',
}

export const ROAST_LABELS: Record<RoastLevel, string> = {
  light: 'Light',
  medium: 'Medium',
  dark: 'Dark',
}
