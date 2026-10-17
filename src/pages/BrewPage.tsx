import { useState } from 'react'
import { ChoiceSheet } from '../components/ChoiceSheet'

const methods = ['V60', 'AeroPress', 'Espresso']

export function BrewPage() {
  const [method, setMethod] = useState('V60')
  return (
    <>
      <h1 className="text-2xl font-semibold">Brew</h1>
      <p className="mt-1 text-muted">Pick a bean and method to get a starting recipe.</p>
      <div className="mt-6">
        <ChoiceSheet title="Method" options={methods} value={method} onChange={setMethod} />
      </div>
    </>
  )
}
