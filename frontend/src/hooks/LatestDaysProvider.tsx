import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { Coverage } from '../api/types'
import { shiftDate, todayUk } from '../design/time'
import { LATEST_LOOKBACK_DAYS, LatestDaysContext, REFRESH_RETRY_MS, type LatestDay, type LiveDatasetId } from './latestDays'

/**
 * Reads one dataset's latest local day: the last present date in the
 * coverage over the lookback window. While gridflow holds the store for a
 * refresh (503 `refresh_in_progress`) it asks again every 15 seconds.
 */
function useLatestFor(id: LiveDatasetId): LatestDay {
  const [day, setDay] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<ApiError | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const end = todayUk()
    const start = shiftDate(end, -LATEST_LOOKBACK_DAYS)
    fetchJson<Coverage>(`/api/datasets/${id}/coverage?start=${start}&end=${end}`, controller.signal)
      .then((c) => {
        setDay(c.present_dates.at(-1) ?? null)
        setError(null)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
      })
    return () => controller.abort()
  }, [id, tick])

  useEffect(() => {
    if (error?.code !== 'refresh_in_progress') return undefined
    const timer = window.setTimeout(() => setTick((n) => n + 1), REFRESH_RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [error])

  const refresh = useCallback(() => setTick((n) => n + 1), [])
  return useMemo(() => ({ day, error, refresh }), [day, error, refresh])
}

export function LatestDaysProvider({ children }: { children: ReactNode }) {
  const generation = useLatestFor('generation-mix')
  const prices = useLatestFor('system-prices')
  const value = useMemo(() => ({ 'generation-mix': generation, 'system-prices': prices }), [generation, prices])
  return <LatestDaysContext.Provider value={value}>{children}</LatestDaysContext.Provider>
}
