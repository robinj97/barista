import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { keys } from './hooks/keys'
import { useOptimisticMutation } from './hooks/mutations'
import { readOutbox, saveOrQueue } from './outbox'

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

describe('useOptimisticMutation', () => {
  const key = ['things'] as const

  it('shows the change at once, then refetches what the save touched', async () => {
    const { client, wrapper } = setup()
    client.setQueryData<string[]>(key, ['a'])
    const refetch = vi.spyOn(client, 'invalidateQueries')
    let release = () => {}
    const { result } = renderHook(
      () =>
        useOptimisticMutation<string, string[]>({
          queryKey: key,
          mutationFn: () => new Promise<void>((resolve) => (release = resolve)),
          apply: (current = [], added) => [...current, added],
          invalidate: () => [key],
        }),
      { wrapper },
    )
    act(() => result.current.mutate('b'))
    await waitFor(() => expect(client.getQueryData(key)).toEqual(['a', 'b']))
    release()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(refetch).toHaveBeenCalledWith({ queryKey: key })
  })

  it('puts the data back and says so when saving fails', async () => {
    const { client, wrapper } = setup()
    client.setQueryData<string[]>(key, ['a'])
    const onFailure = vi.fn()
    const { result } = renderHook(
      () =>
        useOptimisticMutation<string, string[]>({
          queryKey: key,
          mutationFn: async () => {
            throw new Error('nope')
          },
          apply: (current = [], added) => [...current, added],
          invalidate: () => [key],
          onFailure,
        }),
      { wrapper },
    )
    act(() => result.current.mutate('b'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData(key)).toEqual(['a'])
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error), 'b')
  })

  it('lets the caller choose what to refetch from the result, for example nothing when a save is queued', async () => {
    const { client, wrapper } = setup()
    const refetch = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(
      () =>
        useOptimisticMutation<string, string[], 'saved' | 'queued'>({
          queryKey: key,
          mutationFn: async () => 'queued',
          apply: (current) => current,
          invalidate: (outcome) => (outcome === 'queued' ? [] : [key]),
        }),
      { wrapper },
    )
    act(() => result.current.mutate('x'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(refetch).not.toHaveBeenCalled()
  })
})

describe('saveOrQueue', () => {
  const entry = { key: 'bag:1', kind: 'bag', bagId: '1', patch: { gramsRemaining: 10 } } as const

  it('says saved when the write goes through', async () => {
    expect(await saveOrQueue(async () => {}, entry)).toBe('saved')
    expect(readOutbox()).toHaveLength(0)
  })

  it('keeps the write on the phone when the connection is down', async () => {
    const outcome = await saveOrQueue(async () => {
      throw new TypeError('Failed to fetch')
    }, entry)
    expect(outcome).toBe('queued')
    expect(readOutbox()).toHaveLength(1)
  })

  it('does not hide a real failure', async () => {
    await expect(
      saveOrQueue(async () => {
        throw new Error('bag_not_found')
      }, entry),
    ).rejects.toThrow('bag_not_found')
    expect(readOutbox()).toHaveLength(0)
  })
})

describe('query keys', () => {
  it('name one list each, so a change can say exactly what it made stale', () => {
    expect(keys.bags).toEqual(['bags', 'mine'])
    expect(keys.beans.search('elto')).toEqual(['beans', 'search', 'elto'])
    expect(keys.beans.search('elto').slice(0, 2)).toEqual(keys.beans.searches)
    expect(keys.invite('abc')).toEqual(['invite', 'abc'])
  })
})
