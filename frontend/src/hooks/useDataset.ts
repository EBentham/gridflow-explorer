import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { DataRecord } from '../api/types'
import type { DateRange } from '../lib/range'

interface UseDatasetResult {
  data: DataRecord[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches one dataset's records for `range`. The effect depends on
 * `range.start`/`range.end` (not the `range` object), so a fresh object
 * with unchanged values — e.g. re-clicking the active preset — does not
 * retrigger a fetch.
 */
export function useDataset(datasetId: string, range: DateRange): UseDatasetResult {
  const [data, setData] = useState<DataRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const path = `/api/datasets/${datasetId}/data?start=${range.start}&end=${range.end}`
    fetchJson<DataRecord[]>(path, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
      .finally(() => {
        // An aborted request's replacement may already be in flight (StrictMode's
        // dev double-effect, or a fast range change) — do not flip loading off for it.
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [datasetId, range.start, range.end])

  return { data, loading, error }
}
