import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Sheet } from '../components/Sheet'
import { useAddBag, useMyBags } from '../data/hooks'
import type { Bag, Bean, BeanMatch, NewBean } from '../data/types'
import { BagStep, type BagDetails } from './BagStep'
import { NewBeanStep } from './NewBeanStep'
import { SearchStep } from './SearchStep'

type Step =
  | { name: 'search' }
  | { name: 'new'; typed: string }
  | { name: 'bag'; target: { kind: 'existing'; bean: Bean } | { kind: 'new'; bean: NewBean; id: string } }

interface AddBagSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLES = { search: 'Add a bag', new: 'New bean', bag: 'Your bag' } as const

/**
 * Search first, then add as new if it is not in the catalogue, then roast date and size.
 * The bag appears in the list at once; the bean page opens for it.
 */
export function AddBagSheet({ open, onOpenChange }: AddBagSheetProps) {
  const [step, setStep] = useState<Step>({ name: 'search' })
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const addBag = useAddBag()
  const bags = useMyBags()

  function pick(match: BeanMatch) {
    const existing = bags.data?.find((bag) => bag.bean.id === match.id)
    if (existing) {
      onOpenChange(false)
      navigate(`/beans/${existing.id}`)
      return
    }
    setStep({ name: 'bag', target: { kind: 'existing', bean: match } })
  }

  function submit(details: BagDetails) {
    if (step.name !== 'bag') return
    const bagId = crypto.randomUUID()
    const { target } = step

    const newBeanId = target.kind === 'new' ? target.id : undefined
    const bean: Bean =
      target.kind === 'existing'
        ? target.bean
        : {
            id: newBeanId!,
            roaster: target.bean.roaster,
            name: target.bean.name,
            origin: target.bean.origin ?? null,
            region: target.bean.region ?? null,
            producer: target.bean.producer ?? null,
            variety: target.bean.variety ?? null,
            process: target.bean.process ?? null,
            altitudeM: target.bean.altitudeM ?? null,
            roastLevel: target.bean.roastLevel ?? null,
            roasterNotes: target.bean.roasterNotes,
          }
    const optimistic: Bag = {
      id: bagId,
      bean,
      roastDate: details.roastDate,
      gramsRemaining: details.grams,
      status: 'new',
      createdAt: new Date().toISOString(),
    }

    addBag.mutate({
      optimistic,
      input: {
        bagId,
        beanId: target.kind === 'existing' ? target.bean.id : undefined,
        newBean: target.kind === 'new' ? target.bean : undefined,
        newBeanId,
        roastDate: details.roastDate,
        grams: details.grams,
      },
    })
    onOpenChange(false)
    navigate(`/beans/${bagId}`)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setStep({ name: 'search' })
          setQuery('')
        }
        onOpenChange(next)
      }}
      title={TITLES[step.name]}
    >
      {step.name === 'search' && (
        <SearchStep
          query={query}
          onQueryChange={setQuery}
          onPick={pick}
          onAddNew={(typed) => setStep({ name: 'new', typed })}
        />
      )}
      {step.name === 'new' && (
        <NewBeanStep
          initialName={step.typed}
          onBack={() => setStep({ name: 'search' })}
          onContinue={(bean) => setStep({ name: 'bag', target: { kind: 'new', bean, id: crypto.randomUUID() } })}
          onPickExisting={pick}
        />
      )}
      {step.name === 'bag' && (
        <BagStep
          beanId={step.target.kind === 'existing' ? step.target.bean.id : step.target.id}
          name={step.target.bean.name}
          roaster={step.target.bean.roaster}
          onBack={() => setStep(step.target.kind === 'existing' ? { name: 'search' } : { name: 'new', typed: step.target.bean.name })}
          onSubmit={submit}
        />
      )}
    </Sheet>
  )
}
