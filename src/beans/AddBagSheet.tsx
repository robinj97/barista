import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { useAddBag, useBeanCatalogue, useMyBags, useRoasters, useScanBag } from '../data/hooks'
import { useApi } from '../data/ApiContext'
import { ScanError, type Bag, type Bean, type BeanMatch, type NewBean, type SimilarBean } from '../data/types'
import { BagStep, type BagDetails } from './BagStep'
import { NewBeanStep } from './NewBeanStep'
import type { Prefill } from './roasters'
import { matchScan, scanToBag, scanToNewBean } from './scan'
import { SearchStep } from './SearchStep'
import { SimilarStep } from './SimilarStep'

type Step =
  | { name: 'search' }
  | { name: 'scanning' }
  /** `bagDraft` carries a scanned roast date and size through to the bag step. */
  | { name: 'new'; prefill: Prefill; draft?: NewBean; fromPhoto?: boolean; bagDraft?: BagDetails }
  /** A new bean that looks like ones already in the catalogue: use one of them, or carry on as a new bean. */
  | { name: 'similar'; bean: NewBean; similar: SimilarBean[]; fromPhoto?: boolean; bagDraft?: BagDetails }
  | {
      name: 'bag'
      target: { kind: 'existing'; bean: Bean } | { kind: 'new'; bean: NewBean; id: string; fromPhoto?: boolean }
      initial?: BagDetails
    }

const SCAN_FAILED: Record<ScanError['reason'], string> = {
  unreadable: "Couldn't read that label. Try again closer and in good light, or search instead.",
  busy: 'Scanning is busy right now. Try again in a minute, or search instead.',
  limit: "That's your 10 scans for today. Search or add it yourself; scans reset tomorrow.",
  failed: "Couldn't scan just now. Search for it, or add it yourself.",
}

interface AddBagSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLES = { search: 'Add a bag', scanning: 'Reading the label', new: 'New bean', similar: 'Is it one of these?', bag: 'Your bag' } as const

/**
 * Search first, then add as new if it is not in the catalogue, then roast date and size.
 * Or photograph the bag: a known bean goes straight to the bag step, a new one opens the
 * new-bean form filled from the label. Either way the person checks before anything is saved.
 * The bag appears in the list at once; the bean page opens for it.
 */
export function AddBagSheet({ open, onOpenChange }: AddBagSheetProps) {
  const [step, setStep] = useState<Step>({ name: 'search' })
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const addBag = useAddBag()
  const bags = useMyBags()
  const roasters = useRoasters().data ?? []
  const catalogue = useBeanCatalogue()
  const scanBag = useScanBag()
  const toast = useToast()
  const api = useApi()
  /** Bumped on every scan and on cancel, so a late answer for an abandoned scan is ignored. */
  const scanAttempt = useRef(0)

  function pick(match: BeanMatch) {
    const existing = bags.data?.find((bag) => bag.bean.id === match.id)
    if (existing) {
      onOpenChange(false)
      navigate(`/beans/${existing.id}`)
      return
    }
    setStep({ name: 'bag', target: { kind: 'existing', bean: match } })
  }

  /** A new bean: the same coffee is reused, one that looks alike is checked with the person, otherwise on to the bag. */
  async function continueWithNew(bean: NewBean, fromPhoto: boolean | undefined, bagDraft: BagDetails | undefined) {
    const toBag = () =>
      setStep({ name: 'bag', target: { kind: 'new', bean, id: crypto.randomUUID(), fromPhoto }, initial: bagDraft })
    let similar: SimilarBean[] = []
    try {
      similar = await api.findSimilarBeans(bean.roaster, bean.name)
    } catch {
      // The check is a courtesy: the database still keeps one entry per coffee when it is saved.
      return toBag()
    }
    const same = similar.find((item) => item.exact)
    if (same) {
      toast.show("That's already in the catalogue, so we're using it.")
      return pick(same.bean)
    }
    if (similar.length > 0) return setStep({ name: 'similar', bean, similar, fromPhoto, bagDraft })
    toBag()
  }

  async function scan(photo: File) {
    const attempt = ++scanAttempt.current
    setStep({ name: 'scanning' })
    try {
      const read = await scanBag.mutateAsync(photo)
      if (attempt !== scanAttempt.current) return
      if (!read.readable || (!read.roaster && !read.name)) {
        toast.show(SCAN_FAILED.unreadable)
        setStep({ name: 'search' })
        return
      }
      const known = matchScan(read, catalogue.data ?? [])
      if (known) {
        const owned = bags.data?.find((bag) => bag.bean.id === known.id)
        if (owned) return pick(known)
        setStep({ name: 'bag', target: { kind: 'existing', bean: known }, initial: scanToBag(read) })
        return
      }
      const draft = scanToNewBean(read)
      setStep({ name: 'new', prefill: { roaster: draft.roaster, name: draft.name }, draft, fromPhoto: true, bagDraft: scanToBag(read) })
    } catch (error) {
      if (attempt !== scanAttempt.current) return
      toast.show(SCAN_FAILED[error instanceof ScanError ? error.reason : 'failed'])
      setStep({ name: 'search' })
    }
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
        // A scan still running when the sheet closes or reopens must not change the step.
        scanAttempt.current++
        if (next) {
          setStep({ name: 'search' })
          setQuery('')
        }
        onOpenChange(next)
      }}
      title={TITLES[step.name]}
      fill={step.name === 'search' || step.name === 'scanning'}
    >
      {step.name === 'search' && (
        <SearchStep
          query={query}
          onQueryChange={setQuery}
          onPick={pick}
          roasters={roasters}
          onAddNew={(prefill) => setStep({ name: 'new', prefill })}
          onScan={(photo) => void scan(photo)}
        />
      )}
      {step.name === 'scanning' && (
        <div className="grid min-h-full place-items-center px-6 text-center">
          <div className="space-y-4">
            <span className="mx-auto block size-14 animate-pulse rounded-full bg-accent-soft" aria-hidden />
            <p role="status" className="text-muted">
              Reading the label…
            </p>
            <button
              type="button"
              onClick={() => {
                scanAttempt.current++
                setStep({ name: 'search' })
              }}
              className="h-11 rounded-full bg-soft px-5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {step.name === 'new' && (
        <NewBeanStep
          draft={step.draft}
          initialRoaster={step.prefill.roaster ?? ''}
          initialName={step.prefill.name ?? ''}
          roasters={roasters}
          fromPhoto={step.fromPhoto}
          onBack={() => setStep({ name: 'search' })}
          onContinue={(bean) => void continueWithNew(bean, step.fromPhoto, step.bagDraft)}
          onPickExisting={pick}
        />
      )}
      {step.name === 'similar' && (
        <SimilarStep
          entered={step.bean}
          similar={step.similar}
          onBack={() => setStep({ name: 'new', prefill: {}, draft: step.bean, fromPhoto: step.fromPhoto, bagDraft: step.bagDraft })}
          onUseExisting={pick}
          onDifferent={() =>
            setStep({ name: 'bag', target: { kind: 'new', bean: step.bean, id: crypto.randomUUID(), fromPhoto: step.fromPhoto }, initial: step.bagDraft })
          }
        />
      )}
      {step.name === 'bag' && (
        <BagStep
          beanId={step.target.kind === 'existing' ? step.target.bean.id : step.target.id}
          name={step.target.bean.name}
          roaster={step.target.bean.roaster}
          initial={step.initial}
          onBack={() =>
            setStep(
              step.target.kind === 'existing'
                ? { name: 'search' }
                : { name: 'new', prefill: {}, draft: step.target.bean, fromPhoto: step.target.fromPhoto, bagDraft: step.initial },
            )
          }
          onSubmit={submit}
        />
      )}
    </Sheet>
  )
}
