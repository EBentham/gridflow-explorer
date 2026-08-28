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
 * `variant_key` query params -- the backend filters on the exact pair, so
 * no client-side re-filtering is needed here).
 *
 * An empty `variantKeys` short-circuits the fetch and resolves to
 * `data: []`, `loading: false` -- matching `useForecastDay.ts`'s
 * corrected contract: an explicitly empty selection means nothing is
 * shown, not "every Variant".
 *
 * The skip decision and any in-flight request are kept genuinely
 * distinct states via a render-time reset (see `useForecastDay.ts`'s
 * docstring for the full rationale: a `useEffect`-only implementation can
 * paint one stale "no metrics" frame on the render where `variantKeys`
 * first becomes non-empty, since effects only run after that render has
 * already been painted).
 *
 * `variantKeys` is compared/passed via `JSON.stringify`/`JSON.parse`, not
 * a joined string -- a `variantKey(...)` value is itself a JSON string
 * and can legitimately contain the character used to join a list, so
 * joining/splitting the list with a separator is not safe (same
 * reasoning as `variantKey()` itself moving off `"::"`-joining a pair).
 */
export function useForecastMetrics(variantKeys: string[]): UseForecastMetricsResult {
  const variantKeysJson = JSON.stringify(variantKeys)
  const skip = variantKeys.length === 0

  const [data, setData] = useState<ForecastMetric[] | null>(() => (skip ? [] : null))
  const [loading, setLoading] = useState(() => !skip)
  const [error, setError] = useState<ApiError | null>(null)
  const [committedKeysJson, setCommittedKeysJson] = useState(variantKeysJson)

  if (committedKeysJson !== variantKeysJson) {
    setCommittedKeysJson(variantKeysJson)
    setData(skip ? [] : null)
    setLoading(!skip)
    setError(null)
  }

  useEffect(() => {
    const keys = JSON.parse(variantKeysJson) as string[]
    if (keys.length === 0) return undefined

    const controller = new AbortController()

    const params = new URLSearchParams()
    for (const key of keys) params.append('variant_key', key)
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
  }, [variantKeysJson])

  return { data, loading, error }
}
