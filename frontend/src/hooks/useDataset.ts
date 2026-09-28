import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { DataRecord } from '../api/types'
import type { DateRange } from '../lib/range'

interface UseDatasetResult {
  data: DataRecord[] | null
  loading: boolean
  error: ApiError | null
  /** Re-runs the fetch for the current `datasetId`/`range` without changing either. */
  refetch: () => void
}

/**
 * Fetches one dataset's records for `range`; a null range (the latest local
 * day is still being read) waits without fetching. The effect depends on
 * `range.start`/`range.end` (not the `range` object), so a fresh object with
 * unchanged values, e.g. re-clicking the active preset, does not retrigger a
 * fetch. `refetch` bumps an internal counter in the same dependency array,
 * so a fetch-job completion can force a reload of an unchanged range.
 */
export function useDataset(datasetId: string, range: DateRange | null): UseDatasetResult {
  const [data, setData] = useState<DataRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [refetchTick, setRefetchTick] = useState(0)
  const start = range?.start
  const end = range?.end

  useEffect(() => {
    if (!start || !end) return undefined
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const path = `/api/datasets/${datasetId}/data?start=${start}&end=${end}`
    fetchJson<DataRecord[]>(path, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
      .finally(() => {
        // An aborted request's replacement may already be in flight (StrictMode's
        // dev double-effect, or a fast range change): don't flip loading off for it.
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [datasetId, start, end, refetchTick])

  const refetch = useCallback(() => setRefetchTick((tick) => tick + 1), [])

  return { data, loading, error, refetch }
}
