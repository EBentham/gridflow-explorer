import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastDayRecord } from '../api/types'
import { variantKey } from '../api/types'

interface UseForecastDayResult {
  data: ForecastDayRecord[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches `/api/forecasts/day` for `date`, restricted to `variantKeys`
 * (`variantKey(model_id, vintage_policy_id)` pairs; empty means every
 * Variant present, matching the backend's "omitted" default). `date` is
 * nullable so a caller still resolving the default day (e.g. from
 * `/variants`) can skip firing a request with an empty/invalid date.
 *
 * The backend's `model_id`/`vintage_policy_id` query params AND
 * independently, so they cannot express an arbitrary *set of pairs* on
 * their own (selecting `(m1, pA)` and `(m2, pB)` would also match
 * `(m1, pB)` if that pair ever existed). This hook sends the **union** of
 * each dimension to narrow the request, then filters the response
 * client-side to the exact requested pairs before returning it — the
 * union is over-inclusive only in transit, never in what the caller sees.
 *
 * The effect depends on `date` and the joined `variantKeys` (not the
 * array reference), so a fresh-but-unchanged selection array from a
 * re-render does not retrigger a fetch — same principle as
 * `useDataset.ts`'s `range.start`/`range.end` dependency choice.
 */
export function useForecastDay(date: string | null, variantKeys: string[]): UseForecastDayResult {
  const [data, setData] = useState<ForecastDayRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const variantKeysJoined = variantKeys.join(',')

  useEffect(() => {
    if (!date) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const pairs = variantKeysJoined === '' ? [] : variantKeysJoined.split(',')
    const pairSet = new Set(pairs)
    const modelIds = new Set(pairs.map((pair) => pair.split('::')[0]))
    const policyIds = new Set(pairs.map((pair) => pair.split('::')[1]))

    const params = new URLSearchParams({ date })
    for (const modelId of modelIds) params.append('model_id', modelId)
    for (const policyId of policyIds) params.append('vintage_policy_id', policyId)
    const path = `/api/forecasts/day?${params.toString()}`

    fetchJson<ForecastDayRecord[]>(path, controller.signal)
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
  }, [date, variantKeysJoined])

  return { data, loading, error }
}
