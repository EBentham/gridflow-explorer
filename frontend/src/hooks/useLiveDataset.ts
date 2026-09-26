import { useCallback, useEffect } from 'react'
import type { ApiError } from '../api/client'
import type { DataRecord } from '../api/types'
import type { ViewState } from '../design/frame'
import { useAnchoredRange, type RangeState } from '../design/range'
import { REFRESH_RETRY_MS, useLatestDay, type LiveDatasetId } from './latestDays'
import { useDataset } from './useDataset'

export interface LiveDataset {
  range: RangeState
  records: DataRecord[]
  state: ViewState
  error: ApiError | null
  /** After a fetch job lands: reload the rows and re-read the latest day. */
  reload: () => void
}

/**
 * One live dataset on a pinned screen: its latest local day, the toolbar's
 * range anchored on it, the rows for that range, and the screen state. While
 * gridflow holds the store for a refresh the rows are asked for again every
 * 15 seconds.
 */
export function useLiveDataset(id: LiveDatasetId): LiveDataset {
  const latest = useLatestDay(id)
  const range = useAnchoredRange(latest.day)
  const { data, loading, error, refetch } = useDataset(id, range.range)

  useEffect(() => {
    if (error?.code !== 'refresh_in_progress') return undefined
    const timer = window.setTimeout(refetch, REFRESH_RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [error, refetch])

  const { refresh } = latest
  const reload = useCallback(() => {
    refetch()
    refresh()
  }, [refetch, refresh])

  // A failed latest-day read only matters while no day is known.
  const failure = (latest.day === undefined ? latest.error : null) ?? error
  const state: ViewState = failure
    ? failure.code === 'refresh_in_progress'
      ? 'refreshing'
      : 'error'
    : loading || !range.range
      ? 'loading'
      : !data || data.length === 0
        ? 'empty'
        : 'data'

  return { range, records: state === 'data' && data ? data : [], state, error: failure, reload }
}
