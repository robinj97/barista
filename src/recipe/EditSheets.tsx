import { useState } from 'react'
import { settingToMicrons } from '../../engine/grinder.ts'
import { LIMITS } from '../../engine/overrides.ts'
import { fromDisplayTemp, toDisplayTemp } from '../../engine/units.ts'
import { EditSheet } from '../brew/EditSheet'
import { doseFor, resetEdit, setDose, setGrind, setPours, setRatio, setTemp, setTime, setWater } from '../brew/edits'
import { PoursSheet } from '../brew/PoursSheet'
import { SegmentedControl } from '../components/SegmentedControl'
import type { RecipeModel } from './model'

/** What can be edited on the recipe. `null` means nothing is open. */
export type EditField = 'dose' | 'water' | 'ratio' | 'temp' | 'time' | 'grind' | 'pours'

const doseProblem = (doseG: number): string | null =>
  doseG < LIMITS.doseG[0] || doseG > LIMITS.doseG[1] ? `That needs ${doseG} g of coffee; use ${LIMITS.doseG[0]} to ${LIMITS.doseG[1]} g.` : null

interface KeepSwitchProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  note: string
}

/** "Keep: Coffee | Ratio": which of the linked numbers stays put when you change another. */
function KeepSwitch<T extends string>({ label, options, value, onChange, note }: KeepSwitchProps<T>) {
  return (
    <div className="mt-2 px-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <SegmentedControl label={label} options={options} value={value} onChange={onChange} />
      </div>
      <p className="mt-1 text-right text-xs text-muted">{note}</p>
    </div>
  )
}

interface RecipeEditSheetsProps {
  model: RecipeModel
  editing: EditField | null
  onClose: () => void
}

/** The sheet for each number you can change, with the linking rules for coffee, water and ratio. */
export function RecipeEditSheets({ model, editing, onClose }: RecipeEditSheetsProps) {
  const { choices, recipe, shown, unit, grinder, converted, apply, has } = model
  const [keepWater, setKeepWater] = useState(false)
  const [waterKeeps, setWaterKeeps] = useState<'coffee' | 'ratio'>('coffee')
  const [ratioKeeps, setRatioKeeps] = useState<'coffee' | 'water'>('coffee')
  const open = (field: EditField) => ({ open: editing === field, onOpenChange: (next: boolean) => !next && onClose() })
  const inGrinderUnits = converted && grinder

  return (
    <>
      <EditSheet
        {...open('dose')}
        title="Coffee"
        value={recipe.doseG}
        unit="g"
        step={0.5}
        places={1}
        min={LIMITS.doseG[0]}
        max={LIMITS.doseG[1]}
        onSave={(value) => apply(setDose(choices, value, keepWater ? 'water' : 'ratio', shown))}
        onReset={has('doseG') ? () => apply(resetEdit(choices, 'doseG')) : undefined}
      >
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-sm text-muted">Water</span>
          <SegmentedControl
            label="Water when coffee changes"
            options={[
              { value: 'follow', label: 'Follows ratio' },
              { value: 'keep', label: 'Stays' },
            ]}
            value={keepWater ? 'keep' : 'follow'}
            onChange={(value) => setKeepWater(value === 'keep')}
          />
        </div>
      </EditSheet>
      <EditSheet
        {...open('water')}
        title="Water"
        value={recipe.waterG}
        unit="g"
        step={10}
        min={LIMITS.waterG[0]}
        max={LIMITS.waterG[1]}
        check={(value) => (waterKeeps === 'ratio' ? doseProblem(doseFor(value, shown.ratio)) : null)}
        onSave={(value) => apply(setWater(choices, value, waterKeeps, shown))}
        onReset={has('waterG', 'ratio', 'pours') ? () => apply(resetEdit(choices, 'waterG', 'ratio', 'pours')) : undefined}
      >
        <KeepSwitch
          label="Keep"
          options={[
            { value: 'coffee', label: 'Coffee' },
            { value: 'ratio', label: 'Ratio' },
          ]}
          value={waterKeeps}
          onChange={setWaterKeeps}
          note={waterKeeps === 'ratio' ? 'The coffee is calculated from the water.' : 'The ratio changes.'}
        />
      </EditSheet>
      <EditSheet
        {...open('ratio')}
        title="Ratio (1 : …)"
        value={recipe.ratio}
        unit=""
        step={0.5}
        places={1}
        min={LIMITS.ratio[0]}
        max={LIMITS.ratio[1]}
        check={(value) => (ratioKeeps === 'water' ? doseProblem(doseFor(recipe.waterG, value)) : null)}
        onSave={(value) => apply(setRatio(choices, value, recipe.doseG, ratioKeeps, shown))}
        onReset={has('ratio', 'waterG', 'pours') ? () => apply(resetEdit(choices, 'ratio', 'waterG', 'pours')) : undefined}
      >
        <KeepSwitch
          label="Keep"
          options={[
            { value: 'coffee', label: 'Coffee' },
            { value: 'water', label: 'Water' },
          ]}
          value={ratioKeeps}
          onChange={setRatioKeeps}
          note={ratioKeeps === 'water' ? 'The coffee is calculated from the ratio.' : 'The water changes.'}
        />
      </EditSheet>
      <EditSheet
        {...open('temp')}
        title="Water temp"
        value={toDisplayTemp(recipe.tempC, unit)}
        unit={unit === 'c' ? '°C' : '°F'}
        step={1}
        places={unit === 'c' ? 1 : 0}
        min={Math.ceil(toDisplayTemp(LIMITS.tempC[0], unit))}
        max={Math.floor(toDisplayTemp(LIMITS.tempC[1], unit))}
        onSave={(value) => apply(setTemp(choices, Math.round(fromDisplayTemp(value, unit) * 10) / 10))}
        onReset={has('tempC') ? () => apply(resetEdit(choices, 'tempC')) : undefined}
      />
      <EditSheet
        {...open('time')}
        title="Total time"
        value={recipe.targetTimeS}
        unit="s"
        step={5}
        min={LIMITS.targetTimeS[0]}
        max={LIMITS.targetTimeS[1]}
        onSave={(value) => apply(setTime(choices, value))}
        onReset={has('targetTimeS') ? () => apply(resetEdit(choices, 'targetTimeS')) : undefined}
      />
      <EditSheet
        {...open('grind')}
        title="Grind"
        value={inGrinderUnits ? converted.setting : recipe.grindUm}
        unit={grinder?.grinder.unitLabel ?? 'µm'}
        step={inGrinderUnits ? grinder.grinder.step : 10}
        places={converted ? 1 : 0}
        min={inGrinderUnits ? (grinder.grinder.min ?? 0) : LIMITS.grindUm[0]}
        max={inGrinderUnits ? (grinder.grinder.max ?? 1000) : LIMITS.grindUm[1]}
        onSave={(value) => {
          const microns = inGrinderUnits ? settingToMicrons(grinder.grinder, value, grinder.offsetUm).microns : value
          apply(setGrind(choices, Math.min(LIMITS.grindUm[1], Math.max(LIMITS.grindUm[0], Math.round(microns)))))
        }}
        onReset={has('grindUm') ? () => apply(resetEdit(choices, 'grindUm')) : undefined}
      />
      <PoursSheet
        {...open('pours')}
        pours={recipe.pours}
        edited={has('pours')}
        onSave={(pours) => apply(setPours(choices, pours))}
        onReset={() => apply(resetEdit(choices, 'pours'))}
      />
    </>
  )
}
