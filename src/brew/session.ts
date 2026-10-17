/**
 * A brew in progress, kept on the phone so closing the app or locking the screen does not lose
 * the timer. Times are measured from `startedAt` (wall clock), never counted, so they stay right.
 */
export interface BrewSession {
  bagId: string
  /** The recipe screen's query string: the choices and edits this brew was started from. */
  search: string
  /** The day the recipe was worked out for (it depends on how old the roast is). */
  asOf: string
  startedAt: number
  /** Seconds from the start to the end of the drawdown; set when the brew is finished. */
  finishedS: number | null
  /** The brew was finished without running the timer, so there is no total time. */
  untimed?: boolean
}

const STORAGE_KEY = 'barista.brew-session'

export function readSession(): BrewSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as BrewSession | null
    return parsed && typeof parsed.startedAt === 'number' && typeof parsed.bagId === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function writeSession(session: BrewSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Without storage the brew still runs; it just cannot be resumed after a reload.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}

export const startSession = (bagId: string, search: string, asOf: string, nowMs: number): BrewSession => ({
  bagId,
  search,
  asOf,
  startedAt: nowMs,
  finishedS: null,
})

export const elapsedS = (session: BrewSession, nowMs: number): number => Math.max(0, Math.floor((nowMs - session.startedAt) / 1000))

/** Ends the drawdown: the one thing the schedule cannot know, so it is the one tap. */
export function finishSession(session: BrewSession, nowMs: number): BrewSession {
  if (session.finishedS !== null) return session
  return { ...session, finishedS: elapsedS(session, nowMs) }
}

/** For people who brew without the timer: a finished brew with no time to record. */
export const untimedSession = (bagId: string, search: string, asOf: string, nowMs: number): BrewSession => ({
  ...startSession(bagId, search, asOf, nowMs),
  finishedS: 0,
  untimed: true,
})
