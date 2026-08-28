import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastVariant } from '../api/types'

interface UseForecastVariantsResult {
  data: ForecastVariant[] | null
  loading: boolean
  error: ApiError | null
}

/** Fetches the forecast Variant list (`/api/forecasts/variants`) once on mount. */
export function useForecastVariants(): UseForecastVariantsResult {
  const [data, setData] = useState<ForecastVariant[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchJson<ForecastVariant[]>('/api/forecasts/variants', controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
      .finally(() => {
        // An aborted request's replacement may already be in flight (StrictMode's
        // dev double-effect) — do not flip loading off for it.
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return { data, loading, error }
}
