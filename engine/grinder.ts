/**
 * Grinder conversion. Pure: no UI, database or network code.
 *
 * Every grind is stored as approximate particle size in microns and shown in each
 * grinder's own units (clicks, dial numbers). A grinder is described by a few
 * calibration points (setting -> microns); everything between them is linear.
 *
 * Conversions are a starting point, not a promise: burr geometry differs, and most
 * grinders only have a handful of points. Callers should surface that.
 */

/**
 * Where a calibration point came from. `estimated` means we inferred it (for example from a
 * spec sheet plus method recommendations) and nobody has measured it.
 */
export type CalibrationSource = 'manufacturer' | 'chart' | 'learned' | 'estimated'

export interface CalibrationPoint {
  setting: number
  microns: number
  /** Defaults to 'chart' when omitted. */
  source?: CalibrationSource
}

/** How much to trust a result. The UI should show 'low' as a rough estimate. */
export type Confidence = 'low' | 'medium' | 'high'

export interface GrinderModel {
  id: string
  brand: string
  model: string
  unitLabel: string
  /** Smallest adjustment on the grinder (1 click, 0.5 dial notch, ...). */
  step: number
  min?: number | null
  max?: number | null
  points: CalibrationPoint[]
}

export class GrinderCalibrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GrinderCalibrationError'
  }
}

export interface MicronsResult {
  microns: number
  /** True when the setting lies outside the calibrated range and was extrapolated. */
  extrapolated: boolean
  confidence: Confidence
}

export interface SettingResult {
  /** Rounded to the grinder's step. */
  setting: number
  /** Microns the returned setting actually gives (after rounding and offset). */
  microns: number
  extrapolated: boolean
  /** True when the setting was clamped to the grinder's min/max. */
  clamped: boolean
  confidence: Confidence
}

export function isCalibrated(grinder: GrinderModel): boolean {
  return grinder.points.length >= 2
}

/** Points sorted by setting, validated as strictly increasing in both columns. */
function curve(grinder: GrinderModel): CalibrationPoint[] {
  if (!isCalibrated(grinder)) {
    throw new GrinderCalibrationError(`${grinder.brand} ${grinder.model} needs at least two calibration points`)
  }
  const points = [...grinder.points].sort((a, b) => a.setting - b.setting)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const next = points[i]!
    if (next.setting === prev.setting) {
      throw new GrinderCalibrationError(`${grinder.model}: duplicate setting ${next.setting}`)
    }
    if (next.microns <= prev.microns) {
      throw new GrinderCalibrationError(
        `${grinder.model}: microns must increase with setting (${prev.setting} -> ${prev.microns}, ${next.setting} -> ${next.microns})`,
      )
    }
  }
  return points
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }

function lowest(a: Confidence, b: Confidence): Confidence {
  return RANK[a] <= RANK[b] ? a : b
}

/** Trust in a grinder's curve: estimated points are low, all-learned points are high. */
function curveConfidence(grinder: GrinderModel): Confidence {
  const sources = grinder.points.map((point) => point.source ?? 'chart')
  if (sources.includes('estimated')) return 'low'
  if (sources.every((source) => source === 'learned')) return 'high'
  return 'medium'
}

/** Index of the segment [i, i+1] to use for a value, using end segments to extrapolate. */
function segmentFor(points: CalibrationPoint[], value: number, key: 'setting' | 'microns'): number {
  for (let i = 0; i < points.length - 1; i++) {
    if (value <= points[i + 1]![key]) return i
  }
  return points.length - 2
}

function roundToStep(value: number, step: number): number {
  if (!(step > 0)) throw new GrinderCalibrationError('step must be positive')
  const decimals = (String(step).split('.')[1] ?? '').length
  return Number((Math.round(value / step) * step).toFixed(decimals))
}

/**
 * Microns for a setting. `offsetUm` is the user's personal correction: positive means
 * their grinder produces coarser grounds than the catalogue calibration at the same setting.
 */
export function settingToMicrons(grinder: GrinderModel, setting: number, offsetUm = 0): MicronsResult {
  const points = curve(grinder)
  const first = points[0]!
  const last = points.at(-1)!
  const i = segmentFor(points, setting, 'setting')
  const a = points[i]!
  const b = points[i + 1]!
  const t = (setting - a.setting) / (b.setting - a.setting)
  const extrapolated = setting < first.setting || setting > last.setting
  return {
    // Particles cannot be smaller than nothing, even where a line is extended past the burrs touching.
    microns: Math.max(0, a.microns + t * (b.microns - a.microns) + offsetUm),
    extrapolated,
    confidence: extrapolated ? 'low' : curveConfidence(grinder),
  }
}

/** Setting that gives roughly `microns`, rounded to the grinder's step and clamped to its range. */
export function micronsToSetting(grinder: GrinderModel, microns: number, offsetUm = 0): SettingResult {
  const points = curve(grinder)
  const target = microns - offsetUm
  const first = points[0]!
  const last = points.at(-1)!
  const i = segmentFor(points, target, 'microns')
  const a = points[i]!
  const b = points[i + 1]!
  const t = (target - a.microns) / (b.microns - a.microns)
  const raw = a.setting + t * (b.setting - a.setting)
  const extrapolated = target < first.microns || target > last.microns

  let setting = roundToStep(raw, grinder.step)
  let clamped = false
  if (grinder.min != null && setting < grinder.min) {
    setting = grinder.min
    clamped = true
  }
  if (grinder.max != null && setting > grinder.max) {
    setting = grinder.max
    clamped = true
  }

  return {
    setting,
    microns: settingToMicrons(grinder, setting, offsetUm).microns,
    extrapolated,
    clamped,
    confidence: extrapolated || clamped ? 'low' : curveConfidence(grinder),
  }
}

export interface ConvertOptions {
  fromOffsetUm?: number
  toOffsetUm?: number
}

/** Convert a setting on one grinder to the closest setting on another. */
export function convertSetting(
  from: GrinderModel,
  fromSetting: number,
  to: GrinderModel,
  { fromOffsetUm = 0, toOffsetUm = 0 }: ConvertOptions = {},
): SettingResult {
  const source = settingToMicrons(from, fromSetting, fromOffsetUm)
  const result = micronsToSetting(to, source.microns, toOffsetUm)
  return {
    ...result,
    extrapolated: result.extrapolated || source.extrapolated,
    confidence: lowest(result.confidence, source.confidence),
  }
}
