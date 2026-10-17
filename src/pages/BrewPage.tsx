import { useState } from 'react'
import { ChoiceSheet } from '../components/ChoiceSheet'
import { useProfile } from '../data/hooks'
import { METHOD_OPTIONS, type Method } from '../data/types'
import { PageHeader } from '../layout/PageHeader'

export function BrewPage() {
  const profile = useProfile()
  const [chosen, setChosen] = useState<Method | null>(null)
  const method = chosen ?? profile.data?.default_method ?? 'v60'

  return (
    <>
      <PageHeader title="Brew" subtitle="Pick a bean and method to get a starting recipe." />
      <div className="mt-6">
        <ChoiceSheet title="Method" options={METHOD_OPTIONS} value={method} onChange={setChosen} />
      </div>
    </>
  )
}
