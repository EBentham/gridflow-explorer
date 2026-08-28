import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastMetric } from '../api/types'
import { variantKey } from '../api/types'

interface UseForecastMetricsResult {
  data: ForecastMetric[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches `/api/forecasts/metrics` restricted to `variantKeys`
 * (`variantKey(model_id, vintage_policy_id)` pairs; empty means every
 * Variant present). Sends the union of each dimension and filters the
 * response to the exact requested pairs client-side — see
 * `useForecastDay.ts`'s docstring for why (the API's two filters AND
 * independently and cannot express an arbitrary pair set alone).
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
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const pairs = variantKeysJoined === '' ? [] : variantKeysJoined.split(',')
    const pairSet = new Set(pairs)
    const modelIds = new Set(pairs.map((pair) => pair.split('::')[0]))
    const policyIds = new Set(pairs.map((pair) => pair.split('::')[1]))

    const params = new URLSearchParams()
    for (const modelId of modelIds) params.append('model_id', modelId)
    for (const policyId of policyIds) params.append('vintage_policy_id', policyId)
    const query = params.toString()
    const path = query ? `/api/forecasts/metrics?${query}` : '/api/forecasts/metrics'

    fetchJson<ForecastMetric[]>(path, controller.signal)
      .then((records) => {
        const filtered =
          pairSet.size === 0
            ? records
            : records.filter((r) => pairSet.has(variantKey(r.model_id, r.vintage_policy_id)))
        setData(filtered)
      })
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
