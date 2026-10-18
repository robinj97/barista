import { useState } from 'react'
import { useNavigate } from 'react-router'
import { afterBrew, isEmpty } from '../brew/bagUsage'
import { primeSound } from '../brew/cues'
import { toSearchParams } from '../brew/params'
import { clearSession, finishSession, readSession, startSession, untimedSession, writeSession, type BrewSession } from '../brew/session'
import { useNow, useWakeLock } from '../brew/useBrewClock'
import { useUpdateBag } from '../data/hooks'
import type { RecipeModel } from './model'

/** The time of a tap; kept out of the component so it is clearly not read while rendering. */
const clockNow = () => Date.now()

/**
 * A brew in progress for the bean on screen: the timer, and the moves between planning, brewing
 * and logging. The session is kept on the phone, so closing the app does not lose it.
 */
export function useBrewRun({ bag, choices, recipe }: Pick<RecipeModel, 'bag' | 'choices' | 'recipe'>, today: string) {
  const navigate = useNavigate()
  const updateBag = useUpdateBag()
  const [session, setSession] = useState<BrewSession | null>(readSession)
  const brewing = session !== null && session.finishedS === null && session.bagId === bag.id
  const now = useNow(brewing)
  useWakeLock(brewing)

  /** The recipe screen's query string, so the log can show exactly what was brewed. */
  const search = () => toSearchParams({ ...choices, bagId: bag.id }).toString()

  /** A brew is over: the coffee is spent, so it comes out of the bag, then on to the log. */
  const complete = (done: BrewSession) => {
    writeSession(done)
    setSession(done)
    const patch = afterBrew(bag, recipe.doseG)
    if (!isEmpty(patch)) updateBag.mutate({ bagId: bag.id, patch })
    void navigate('/brew/log')
  }

  return {
    session,
    brewing,
    now,
    startTimer: () => {
      primeSound()
      const next = startSession(bag.id, search(), today, clockNow(), recipe)
      writeSession(next)
      setSession(next)
    },
    /** The drawdown is over. */
    finish: () => {
      if (session) complete(finishSession(session, clockNow()))
    },
    /** For people who brew without the timer. */
    finishUntimed: () => complete(untimedSession(bag.id, search(), today, clockNow(), recipe)),
    cancel: () => {
      clearSession()
      setSession(null)
    },
  }
}
