import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastMetric } from '../api/types'

interface UseForecastMetricsResult {
  data: ForecastMetric[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches `/api/forecasts/metrics` restricted to `variantKeys`
 * (`variantKey(model_id, vintage_policy_id)` pairs, sent as repeated
 * `variant_key` query params — the backend filters on the exact pair, so
 * no client-side re-filtering is needed here).
 *
 * An empty `variantKeys` short-circuits the fetch and resolves to `[]`,
 * matching `useForecastDay.ts`'s corrected contract: an explicitly empty
 * selection means nothing is shown, not "every Variant" (see that hook's
 * docstring for the defect this closes).
 *
 * Depends on the joined `variantKeys`, not the array reference — same
 * principle as `useForecastDay.ts`.
 */
export function useForecastMetrics(variantKeys: string[]): UseForecastMetricsResult {
  const [data, setData] = useState<ForecastMetric[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const variantKeysJoined = variantKeys.join(',')

  useEffect(() => {
    if (variantKeysJoined === '') {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    for (const key of variantKeysJoined.split(',')) params.append('variant_key', key)
    const path = `/api/forecasts/metrics?${params.toString()}`

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
  }, [variantKeysJoined])

  return { data, loading, error }
}
