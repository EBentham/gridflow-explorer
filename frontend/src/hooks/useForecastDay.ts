import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastDayRecord } from '../api/types'

interface UseForecastDayResult {
  data: ForecastDayRecord[] | null
  loading: boolean
  error: ApiError | null
}

/**
 * Fetches `/api/forecasts/day` for `date`, restricted to `modelIds` (empty
 * means every Variant present, matching the backend's "omitted" default).
 * `date` is nullable so a caller still resolving the default day (e.g. from
 * `/variants`) can skip firing a request with an empty/invalid date.
 *
 * The effect depends on `date` and the joined `modelIdsKey` (not the
 * `modelIds` array reference), so a fresh-but-unchanged selection array
 * from a re-render does not retrigger a fetch — same principle as
 * `useDataset.ts`'s `range.start`/`range.end` dependency choice.
 */
export function useForecastDay(date: string | null, modelIds: string[]): UseForecastDayResult {
  const [data, setData] = useState<ForecastDayRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const modelIdsKey = modelIds.join(',')

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

    const params = new URLSearchParams({ date })
    for (const modelId of modelIdsKey === '' ? [] : modelIdsKey.split(',')) {
      params.append('model_id', modelId)
    }
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
  }, [date, modelIdsKey])

  return { data, loading, error }
}
