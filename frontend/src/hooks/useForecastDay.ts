import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastDayRecord } from '../api/types'

interface UseForecastDayResult {
  data: ForecastDayRecord[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches `/api/forecasts/day` for `date`, restricted to `variantKeys`
 * (`variantKey(model_id, vintage_policy_id)` pairs, sent as repeated
 * `variant_key` query params — the backend validates and filters on the
 * exact pair, so no client-side re-filtering is needed here).
 *
 * Two states short-circuit the fetch entirely and resolve to an empty
 * result:
 *   - `date` is `null` — the caller (e.g. `ForecastScreen`) is still
 *     resolving the default day from `/variants`.
 *   - `variantKeys` is empty — the caller has explicitly deselected every
 *     Variant. This does **not** mean "every Variant" (that was a real
 *     defect, caught by Sol diff review: unchecking every checkbox used to
 *     still fetch and render everything, contradicting the screen's own
 *     controls). An empty selection means nothing is selected, so nothing
 *     is fetched and nothing is shown — the caller renders its empty
 *     state from a `[]` result exactly as it would for a day with no
 *     forecasts.
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
    if (!date || variantKeysJoined === '') {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ date })
    for (const key of variantKeysJoined.split(',')) params.append('variant_key', key)
    const path = `/api/forecasts/day?${params.toString()}`

    fetchJson<ForecastDayRecord[]>(path, controller.signal)
      .then(setData)
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
