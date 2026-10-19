import type { Confidence } from '../../engine/grinder.ts'
import type { SuggestOutput } from '../../engine/types.ts'

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  low: 'Starting point · expect 2–3 brews',
  medium: 'Informed by similar brews',
  high: 'Based on your own recipe',
}

/** What the starting point is based on, in a few words. Tap to see why. */
export function ConfidencePill({ out, onOpen }: { out: SuggestOutput; onOpen: () => void }) {
  const { confidence } = out
  const text =
    out.overridden.length > 0
      ? 'Your edits · started from a suggestion'
      : confidence.source === 'friend' && confidence.who
        ? `Based on ${confidence.who}`
        : CONFIDENCE_TEXT[confidence.level]
  return (
    <button type="button" onClick={onOpen} className="mx-auto mt-5 flex h-9 items-center rounded-full bg-accent-soft px-4 text-sm text-accent">
      {text} ›
    </button>
  )
}
