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
 * Fetches one dataset's records for `range`. Callers must memoize `range`
 * (e.g. `useMemo`) — a fresh object every render would retrigger the effect.
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
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [datasetId, range])

  return { data, loading, error }
}
