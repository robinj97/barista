import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'

/** Marks queries stale so they refetch. Resolves when they have, for callers that wait on it. */
export function useInvalidate() {
  const client = useQueryClient()
  return (...queryKeys: QueryKey[]) => Promise.all(queryKeys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

interface OptimisticOptions<TInput, TData, TResult> {
  queryKey: QueryKey
  mutationFn: (input: TInput) => Promise<TResult>
  /** The cached data as it should look straight away. Return `current` to leave it alone. */
  apply: (current: TData | undefined, input: TInput) => TData | undefined
  /** Queries to refetch afterwards. `result` is undefined when the save failed. */
  invalidate: (result: TResult | undefined, input: TInput) => QueryKey[]
  onFailure?: (error: unknown, input: TInput) => void
}

/**
 * A change that shows on screen at once and is put back if saving fails: cancel what is loading,
 * remember the data, show the new data, roll back on failure, then refetch what the save touched.
 */
export function useOptimisticMutation<TInput, TData, TResult = void>({ queryKey, mutationFn, apply, invalidate, onFailure }: OptimisticOptions<TInput, TData, TResult>) {
  const client = useQueryClient()
  const invalidateAll = useInvalidate()
  return useMutation({
    mutationFn,
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey })
      const previous = client.getQueryData<TData>(queryKey)
      client.setQueryData<TData | undefined>(queryKey, (current) => apply(current, input))
      return { previous }
    },
    onError: (error, input, context) => {
      client.setQueryData(queryKey, context?.previous)
      onFailure?.(error, input)
    },
    onSettled: (result, _error, input) => invalidateAll(...invalidate(result, input)),
  })
}
