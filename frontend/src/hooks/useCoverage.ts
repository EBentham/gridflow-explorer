import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { Coverage } from '../api/types'
import type { DateRange } from '../lib/range'

interface UseCoverageResult {
  coverage: Coverage | null
  loading: boolean
  error: ApiError | null
  /** Re-runs the fetch for the current `datasetId`/`range` without changing either. */
  refetch: () => void
}

/**
 * Fetches one dataset's local coverage for `range` — same shape and abort
 * discipline as `useDataset`: the effect depends on `range.start`/
 * `range.end` (not the `range` object), and `refetch` bumps an internal
 * counter in the same dependency array so a completed fetch job can force
 * a reload without a range change.
 */
export function useCoverage(datasetId: string, range: DateRange): UseCoverageResult {
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [refetchTick, setRefetchTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const path = `/api/datasets/${datasetId}/coverage?start=${range.start}&end=${range.end}`
    fetchJson<Coverage>(path, controller.signal)
      .then(setCoverage)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [datasetId, range.start, range.end, refetchTick])

  const refetch = useCallback(() => setRefetchTick((tick) => tick + 1), [])

  return { coverage, loading, error, refetch }
}
