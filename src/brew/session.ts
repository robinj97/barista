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
  /** Seconds from the start to each pour being ticked off. */
  ticksS: number[]
  /** Seconds from the start to the end of the drawdown; set when the brew is finished. */
  finishedS: number | null
}

const STORAGE_KEY = 'barista.brew-session'

export function readSession(): BrewSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as BrewSession | null
    return parsed && typeof parsed.startedAt === 'number' && Array.isArray(parsed.ticksS) ? parsed : null
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
  ticksS: [],
  finishedS: null,
})

export const elapsedS = (session: BrewSession, nowMs: number): number => Math.max(0, Math.round((nowMs - session.startedAt) / 1000))

/** Ticks off the next pour. Ignored once every pour is ticked or the brew is finished. */
export function tickPour(session: BrewSession, nowMs: number, pourCount: number): BrewSession {
  if (session.finishedS !== null || session.ticksS.length >= pourCount) return session
  return { ...session, ticksS: [...session.ticksS, elapsedS(session, nowMs)] }
}

/** Ends the drawdown. Only possible after the last pour is ticked off. */
export function finishSession(session: BrewSession, nowMs: number, pourCount: number): BrewSession {
  if (session.finishedS !== null || session.ticksS.length < pourCount) return session
  return { ...session, finishedS: Math.max(elapsedS(session, nowMs), session.ticksS.at(-1) ?? 0) }
}

/** Index of the pour waiting to be ticked off, or null when all are done. */
export const currentPour = (session: BrewSession, pourCount: number): number | null =>
  session.ticksS.length < pourCount ? session.ticksS.length : null
