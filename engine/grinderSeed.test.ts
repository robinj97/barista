import { describe, expect, it } from 'vitest'
import { GRINDER_SEED } from './grinderSeed.ts'

const files = import.meta.glob('../supabase/migrations/*_grinder_seed*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const sql = Object.values(files).join('\n')

describe('grinder seed stays in sync with the migration', () => {
  it('finds the migration', () => {
    expect(sql).toContain('insert into public.grinder_calibration')
  })

  it('lists every grinder', () => {
    for (const g of GRINDER_SEED) {
      expect(sql, `${g.brand} ${g.model}`).toContain(`('${g.brand}', '${g.model}', '${g.unitLabel}', ${g.step}, ${g.max ?? 'null'})`)
    }
  })

  it('lists every calibration point and nothing else', () => {
    const expected = GRINDER_SEED.flatMap((g) =>
      g.points.map((p) => `('${g.brand}', '${g.model}', ${p.setting}, ${p.microns})`),
    )
    const rows = [...sql.matchAll(/\('[^']+', '[^']+', \d+, \d+\)/g)].map((m) => m[0])
    expect(rows.sort()).toEqual(expected.sort())
  })

  it('marks the K7 points as estimated and enforces the 15-click floor', () => {
    const k7 = GRINDER_SEED.find((g) => g.model === 'K7')!
    expect(k7.min).toBe(15)
    expect(k7.points.every((p) => p.source === 'estimated')).toBe(true)
    expect(sql).toContain("min_setting = 15 where brand = 'Kingrinder' and model = 'K7'")
    expect(sql).toMatch(/select g\.id, v\.setting, v\.microns, 'estimated'/)
  })
})
