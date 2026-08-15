import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { DatasetSummary } from '../api/types'

interface UseDatasetsResult {
  data: DatasetSummary[] | null
  loading: boolean
  error: ApiError | null
}

/** Fetches the dataset catalogue once on mount. */
export function useDatasets(): UseDatasetsResult {
  const [data, setData] = useState<DatasetSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchJson<DatasetSummary[]>('/api/datasets', controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
      .finally(() => {
        // An aborted request's replacement may already be in flight (StrictMode's
        // dev double-effect, or a fast re-render) — do not flip loading off for it.
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return { data, loading, error }
}
