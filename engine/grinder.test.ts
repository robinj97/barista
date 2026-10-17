import { describe, expect, it } from 'vitest'
import {
  GrinderCalibrationError,
  convertSetting,
  isCalibrated,
  micronsToSetting,
  settingToMicrons,
  type GrinderModel,
} from './grinder.ts'
import { GRINDER_SEED } from './grinderSeed.ts'

const byModel = (model: string): GrinderModel => {
  const found = GRINDER_SEED.find((g) => g.model === model)
  if (!found) throw new Error(`no seed grinder ${model}`)
  return found
}
const df54 = byModel('DF54')
const calibrated = GRINDER_SEED.filter(isCalibrated)

describe('settingToMicrons', () => {
  it('returns calibration points exactly', () => {
    expect(settingToMicrons(df54, 60).microns).toBe(640)
    expect(settingToMicrons(df54, 80).microns).toBe(814)
    expect(settingToMicrons(df54, 85).microns).toBe(850)
  })

  it('interpolates linearly between points', () => {
    const { microns, extrapolated } = settingToMicrons(df54, 78)
    expect(microns).toBeCloseTo((779 + 814) / 2)
    expect(extrapolated).toBe(false)
  })

  it('flags extrapolation outside the calibrated range', () => {
    expect(settingToMicrons(df54, 50).extrapolated).toBe(true)
    expect(settingToMicrons(df54, 90).extrapolated).toBe(true)
    expect(settingToMicrons(df54, 90).microns).toBeGreaterThan(850)
  })

  it('applies the personal offset', () => {
    expect(settingToMicrons(df54, 80, 20).microns).toBe(834)
    expect(settingToMicrons(df54, 80, -14).microns).toBe(800)
  })

  it.each(calibrated.map((g) => [g.model, g] as const))('%s: coarser settings give larger particles', (_name, grinder) => {
    const first = grinder.points[0]!.setting
    expect(settingToMicrons(grinder, first + 1).microns).toBeGreaterThan(settingToMicrons(grinder, first).microns)
  })
})

describe('micronsToSetting', () => {
  it('inverts settingToMicrons at calibration points', () => {
    for (const grinder of calibrated) {
      for (const point of grinder.points) {
        expect(micronsToSetting(grinder, point.microns).setting).toBe(point.setting)
      }
    }
  })

  it('rounds to the grinder step', () => {
    const halfSteps: GrinderModel = {
      id: 't', brand: 'T', model: 'Half', unitLabel: 'dial', step: 0.5,
      points: [{ setting: 10, microns: 400 }, { setting: 20, microns: 800 }],
    }
    expect(micronsToSetting(halfSteps, 612).setting).toBe(15.5)
    expect(micronsToSetting(halfSteps, 600).setting).toBe(15)
  })

  it('removes the personal offset before inverting', () => {
    const plain = micronsToSetting(df54, 814).setting
    expect(micronsToSetting(df54, 834, 20).setting).toBe(plain)
  })

  it('reports the microns the rounded setting actually gives', () => {
    const result = micronsToSetting(byModel('C40'), 835)
    expect(result.setting).toBe(28)
    expect(result.microns).toBe(850)
  })

  it('clamps to the grinder range and says so', () => {
    const maxa = { ...byModel('MAXA'), points: [{ setting: 10, microns: 400 }, { setting: 20, microns: 800 }] }
    const result = micronsToSetting(maxa, 5000)
    expect(result.setting).toBe(60)
    expect(result.clamped).toBe(true)
    expect(result.extrapolated).toBe(true)
  })

  it('round-trips within half a step for in-range sizes', () => {
    for (const grinder of calibrated) {
      const lo = grinder.points[0]!
      const hi = grinder.points.at(-1)!
      for (let microns = lo.microns; microns <= hi.microns; microns += 5) {
        const { setting } = micronsToSetting(grinder, microns)
        const back = settingToMicrons(grinder, setting).microns
        // Rounding to the step can move the result by half a step at the steepest segment.
        const steepest = Math.max(
          ...grinder.points.slice(1).map((p, i) => (p.microns - grinder.points[i]!.microns) / (p.setting - grinder.points[i]!.setting)),
        )
        expect(Math.abs(back - microns)).toBeLessThanOrEqual((steepest * grinder.step) / 2 + 1e-6)
      }
    }
  })
})

describe('convertSetting', () => {
  it('maps DF54 85 (850 µm) to the equivalents we collected', () => {
    const from = (model: string) => convertSetting(df54, 85, byModel(model)).setting
    expect(from('C40')).toBe(28)
    expect(from('K-Ultra')).toBe(43)
    expect(from('JX-Pro')).toBe(68)
    expect(from('C2')).toBe(27)
    expect(from('Encore')).toBe(25)
  })

  it('maps DF54 80 (814 µm) to within a click of the 820 µm equivalents', () => {
    // 814 µm is 6 µm finer than the 820 µm reference pairs, so fine-step grinders land one step lower.
    expect(convertSetting(df54, 80, byModel('C40')).setting).toBe(27)
    expect(convertSetting(df54, 80, byModel('K-Ultra')).setting).toBe(41)
    expect(convertSetting(df54, 80, byModel('JX-Pro')).setting).toBe(64)
  })

  it('round-trips a hand grinder to the DF54 and back', () => {
    const there = convertSetting(byModel('C40'), 28, df54)
    expect(there.setting).toBe(85)
    expect(convertSetting(df54, there.setting, byModel('C40')).setting).toBe(28)
  })

  it('flags conversions that leave either calibrated range', () => {
    expect(convertSetting(df54, 76, byModel('C40')).extrapolated).toBe(true)
    expect(convertSetting(df54, 85, byModel('C40')).extrapolated).toBe(false)
    expect(convertSetting(byModel('C40'), 20, df54).extrapolated).toBe(true)
  })

  it('uses both personal offsets', () => {
    // The friend's DF54 runs 10 µm coarser than catalogue; mine is as catalogued.
    const plain = convertSetting(df54, 80, byModel('C40'))
    const shifted = convertSetting(df54, 80, byModel('C40'), { fromOffsetUm: 30 })
    expect(shifted.setting).toBeGreaterThan(plain.setting)
  })
})

describe('confidence', () => {
  it('is medium for in-range charted curves', () => {
    expect(convertSetting(df54, 85, byModel('C40')).confidence).toBe('medium')
    expect(settingToMicrons(df54, 78).confidence).toBe('medium')
  })

  it('is low whenever the answer is extrapolated or clamped', () => {
    expect(convertSetting(df54, 76, byModel('C40')).confidence).toBe('low')
    expect(settingToMicrons(df54, 90).confidence).toBe('low')
    const maxa = { ...byModel('MAXA'), points: [{ setting: 10, microns: 400 }, { setting: 20, microns: 800 }] }
    expect(micronsToSetting(maxa, 5000).confidence).toBe('low')
  })

  it('is low when either grinder only has estimated points', () => {
    const k7 = byModel('K7')
    expect(settingToMicrons(k7, 60).confidence).toBe('low')
    expect(convertSetting(df54, 85, k7).confidence).toBe('low')
    expect(convertSetting(k7, 60, df54).confidence).toBe('low')
  })

  it('is high only when every point was learned', () => {
    const learned: GrinderModel = {
      id: 'l', brand: 'L', model: 'Learned', unitLabel: 'clicks', step: 1,
      points: [{ setting: 10, microns: 400, source: 'learned' }, { setting: 20, microns: 800, source: 'learned' }],
    }
    expect(settingToMicrons(learned, 15).confidence).toBe('high')
    expect(convertSetting(learned, 15, learned).confidence).toBe('high')
    expect(convertSetting(learned, 18, df54).confidence).toBe('medium') // 720 um is inside the DF54 range
  })
})

describe('Kingrinder K7 (estimated)', () => {
  const k7 = byModel('K7')

  it('passes through the two anchors: espresso ~38 clicks and filter ~100 clicks', () => {
    expect(settingToMicrons(k7, 38).microns).toBe(250)
    expect(settingToMicrons(k7, 100).microns).toBe(800)
  })

  it('puts a V60 grind of about 800 um near 100 clicks, not 70', () => {
    const result = convertSetting(df54, 85, k7)
    expect(result.setting).toBeGreaterThanOrEqual(95)
    expect(result.setting).toBeLessThanOrEqual(120)
  })

  it('keeps the espresso band (30 to 40 clicks) fine and pour-over (95 to 120) medium-coarse', () => {
    const size = (clicks: number) => settingToMicrons(k7, clicks).microns
    expect(size(35)).toBeLessThanOrEqual(300)
    expect(size(95)).toBeGreaterThanOrEqual(600)
    expect(size(120)).toBeLessThanOrEqual(1100)
  })

  it('never suggests a setting below the 15-click safety floor', () => {
    const result = micronsToSetting(k7, 50, 100) // offset pushes the target below the burrs touching
    expect(result.setting).toBe(15)
    expect(result.clamped).toBe(true)
    expect(result.confidence).toBe('low')
  })

  it('does not report negative particle sizes below the floor', () => {
    expect(settingToMicrons(k7, 5).microns).toBe(0)
  })
})

describe('bad calibration', () => {
  const broken = (points: GrinderModel['points']): GrinderModel => ({
    id: 'x', brand: 'X', model: 'Broken', unitLabel: 'clicks', step: 1, points,
  })

  it('refuses grinders without enough points', () => {
    const maxa = byModel('MAXA')
    expect(isCalibrated(maxa)).toBe(false)
    expect(() => settingToMicrons(maxa, 20)).toThrow(GrinderCalibrationError)
    expect(() => micronsToSetting(broken([{ setting: 1, microns: 500 }]), 500)).toThrow(GrinderCalibrationError)
  })

  it('refuses curves that do not get coarser with the setting', () => {
    const bad = broken([{ setting: 1, microns: 500 }, { setting: 2, microns: 480 }])
    expect(() => settingToMicrons(bad, 1)).toThrow(/must increase/)
  })

  it('refuses duplicate settings', () => {
    const bad = broken([{ setting: 1, microns: 500 }, { setting: 1, microns: 520 }])
    expect(() => settingToMicrons(bad, 1)).toThrow(/duplicate/)
  })

  it('accepts points given out of order', () => {
    const ok = broken([{ setting: 2, microns: 600 }, { setting: 1, microns: 500 }])
    expect(settingToMicrons(ok, 1.5).microns).toBe(550)
  })
})
