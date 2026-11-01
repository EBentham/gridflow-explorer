import { useCallback, useEffect, useState } from 'react'
import { fetchJson, isAbort, toApiError, type ApiError } from '../api/client'

export interface JsonLoad<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  /** Reads the same path again, keeping the data it has until the answer comes. */
  refetch: () => void
}

interface Held<T> {
  path: string | null
  data: T | null
  loading: boolean
  error: ApiError | null
}

/**
 * Reads `path` as JSON, aborting the read when the path changes or the
 * component goes. A null path reads nothing: with `skipped`, it resolves to
 * that (`[]` for a selection a reader has emptied) and isn't loading;
 * without, it waits, loading, for an input still being read.
 *
 * A new path resets the state during render, React's "adjusting state when a
 * prop changes", so no frame paints the old path's answer as the new one's.
 * A retry of the same path while gridflow holds the store keeps its refresh
 * error until it is answered, so the page keeps saying "refreshing".
 */
export function useJson<T>(path: string | null, { skipped }: { skipped?: T } = {}): JsonLoad<T> {
  const fresh = (): Held<T> => (path === null && skipped !== undefined ? { path, data: skipped, loading: false, error: null } : { path, data: null, loading: true, error: null })
  const [held, setHeld] = useState<Held<T>>(fresh)
  const [tick, setTick] = useState(0)
  if (held.path !== path) setHeld(fresh())

  useEffect(() => {
    if (path === null) return undefined
    const controller = new AbortController()
    setHeld((h) => {
      const error = h.error?.code === 'refresh_in_progress' ? h.error : null
      return h.loading && h.error === error ? h : { ...h, loading: true, error }
    })
    fetchJson<T>(path, controller.signal)
      .then((data) => setHeld((h) => ({ ...h, data, error: null })))
      .catch((err: unknown) => {
        if (!isAbort(err)) setHeld((h) => ({ ...h, error: toApiError(err) }))
      })
      .finally(() => {
        // An aborted read's replacement may already be in flight (StrictMode's
        // dev double effect, or a fast change): don't flip loading off for it.
        if (!controller.signal.aborted) setHeld((h) => ({ ...h, loading: false }))
      })
    return () => controller.abort()
  }, [path, tick])

  const refetch = useCallback(() => setTick((n) => n + 1), [])
  return { data: held.data, loading: held.loading, error: held.error, refetch }
}
