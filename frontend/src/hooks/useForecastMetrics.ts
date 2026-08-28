import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastMetric } from '../api/types'

interface UseForecastMetricsResult {
  data: ForecastMetric[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches `/api/forecasts/metrics` restricted to `modelIds` (empty means
 * every Variant present). Depends on the joined `modelIdsKey`, not the
 * array reference — see `useForecastDay.ts`.
 */
export function useForecastMetrics(modelIds: string[]): UseForecastMetricsResult {
  const [data, setData] = useState<ForecastMetric[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const modelIdsKey = modelIds.join(',')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    for (const modelId of modelIdsKey === '' ? [] : modelIdsKey.split(',')) {
      params.append('model_id', modelId)
    }
    const query = params.toString()
    const path = query ? `/api/forecasts/metrics?${query}` : '/api/forecasts/metrics'

    fetchJson<ForecastMetric[]>(path, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [modelIdsKey])

  return { data, loading, error }
}
