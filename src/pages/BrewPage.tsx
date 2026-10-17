import { useState } from 'react'
import { ChoiceSheet } from '../components/ChoiceSheet'
import { useProfile } from '../data/hooks'
import { METHODS, METHOD_LABELS, type Method } from '../data/types'
import { PageHeader } from '../layout/PageHeader'

export function BrewPage() {
  const profile = useProfile()
  const [chosen, setChosen] = useState<Method | null>(null)
  const method = chosen ?? profile.data?.default_method ?? 'v60'

  return (
    <>
      <PageHeader title="Brew" subtitle="Pick a bean and method to get a starting recipe." />
      <div className="mt-6">
        <ChoiceSheet
          title="Method"
          options={METHODS.map((m) => METHOD_LABELS[m])}
          value={METHOD_LABELS[method]}
          onChange={(label) => setChosen(METHODS.find((m) => METHOD_LABELS[m] === label) ?? 'v60')}
        />
      </div>
    </>
  )
}
