import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApi } from '../ApiContext'
import { flushOutbox } from '../outbox'
import { keys } from './keys'

/** Sends anything saved on the phone while offline: when the app opens and whenever the connection returns. */
export function useFlushOutbox() {
  const api = useApi()
  const client = useQueryClient()
  useEffect(() => {
    let active = true
    const flush = () =>
      void flushOutbox(api).then((sent) => {
        if (active && sent > 0) for (const queryKey of [keys.drafts, keys.recipes, keys.bags]) void client.invalidateQueries({ queryKey })
      })
    flush()
    window.addEventListener('online', flush)
    return () => {
      active = false
      window.removeEventListener('online', flush)
    }
  }, [api, client])
}
