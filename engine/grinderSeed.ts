import type { GrinderModel } from './grinder.ts'

/**
 * Seed grinders and calibration, mirrored in supabase/migrations (grinder seed).
 * A test checks the two stay in sync.
 *
 * Provenance: the DF54 points come from a hand-collected table; the rest are two-point
 * "equivalent setting" pairs at about 820 and 850 microns. They are approximate. Points we
 * could not reconcile (DF54 82 -> 820 and 86 -> 880) are deliberately left out. See
 * docs/grinders.md.
 */
export const GRINDER_SEED: GrinderModel[] = [
  {
    id: 'turin-df54',
    brand: 'Turin',
    model: 'DF54',
    unitLabel: 'dial',
    step: 1,
    points: [
      { setting: 60, microns: 640 },
      { setting: 76, microns: 779 },
      { setting: 80, microns: 814 },
      { setting: 85, microns: 850 },
    ],
  },
  {
    id: 'comandante-c40',
    brand: 'Comandante',
    model: 'C40',
    unitLabel: 'clicks',
    step: 1,
    points: [
      { setting: 27, microns: 820 },
      { setting: 28, microns: 850 },
    ],
  },
  {
    id: '1zpresso-k-ultra',
    brand: '1Zpresso',
    model: 'K-Ultra',
    unitLabel: 'clicks',
    step: 1,
    points: [
      { setting: 41, microns: 820 },
      { setting: 43, microns: 850 },
    ],
  },
  {
    id: '1zpresso-jx-pro',
    brand: '1Zpresso',
    model: 'JX-Pro',
    unitLabel: 'clicks',
    step: 1,
    points: [
      { setting: 65, microns: 820 },
      { setting: 68, microns: 850 },
    ],
  },
  {
    id: 'timemore-c2',
    brand: 'Timemore',
    model: 'C2',
    unitLabel: 'clicks',
    step: 1,
    points: [
      { setting: 26, microns: 820 },
      { setting: 27, microns: 850 },
    ],
  },
  {
    id: 'baratza-encore',
    brand: 'Baratza',
    model: 'Encore',
    unitLabel: 'steps',
    step: 1,
    points: [
      { setting: 24, microns: 820 },
      { setting: 25, microns: 850 },
    ],
  },
  // Listed so people can add them, but not convertible yet: no calibration points.
  { id: '1zpresso-zp6-special', brand: '1Zpresso', model: 'ZP6 Special', unitLabel: 'clicks', step: 1, points: [] },
  { id: 'timemore-bricks-01s', brand: 'Timemore', model: 'Bricks 01S', unitLabel: 'steps', step: 1, points: [] },
  { id: 'lopder-maxa', brand: 'Lopder', model: 'MAXA', unitLabel: 'clicks', step: 1, max: 60, points: [] },
  { id: 'kingrinder-k2', brand: 'Kingrinder', model: 'K2', unitLabel: 'clicks', step: 1, points: [] },
  // K7: 100 clicks per turn, counted from the finest stop; the manual says never grind below
  // 15 clicks. Points are ESTIMATED from reviews and use: espresso ~38 clicks = ~250 um, filter
  // ~100 clicks = ~800 um, about 9 um per click (not the advertised 15). Replace with measured
  // pairs when we have them. See docs/grinders.md.
  {
    id: 'kingrinder-k7',
    brand: 'Kingrinder',
    model: 'K7',
    unitLabel: 'clicks',
    step: 1,
    min: 15,
    points: [
      { setting: 38, microns: 250, source: 'estimated' },
      { setting: 100, microns: 800, source: 'estimated' },
    ],
  },
]
