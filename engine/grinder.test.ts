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
