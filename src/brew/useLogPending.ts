import { useSyncExternalStore } from 'react'
import { logIsPending, subscribeToSession } from './session'

/** Whether a finished brew is waiting to be logged. */
export const useLogPending = (): boolean => useSyncExternalStore(subscribeToSession, logIsPending, () => false)
