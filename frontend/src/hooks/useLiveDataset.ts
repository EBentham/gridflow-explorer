import { useCallback, useEffect } from 'react'
import type { ApiError } from '../api/client'
import type { DataRecord } from '../api/types'
import type { ViewState } from '../design/frame'
import { useAnchoredRange, type RangeState } from '../design/range'
import { invalidateManifest, REFRESH_RETRY_MS } from '../views/_data/hooks'
import { useLatestDays, type LiveDatasetId } from './latestDays'
import { useJson } from './useJson'

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
  const latest = useLatestDays()[id]
  const range = useAnchoredRange(latest.day)
  // A range still waiting for its latest day reads nothing yet.
  const path = range.range ? `/api/datasets/${id}/data?start=${range.range.start}&end=${range.range.end}` : null
  const { data, loading, error, refetch } = useJson<DataRecord[]>(path)

  useEffect(() => {
    if (error?.code !== 'refresh_in_progress') return undefined
    const timer = window.setTimeout(refetch, REFRESH_RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [error, refetch])

  const reload = useCallback(() => {
    refetch()
    invalidateManifest()
  }, [refetch])

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
