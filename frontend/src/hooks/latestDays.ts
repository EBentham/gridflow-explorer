/**
 * The latest UK day with local data for each live dataset, read once at the
 * app root from the coverage endpoint. Screens anchor their default range on
 * their own dataset's day; the rail foot shows the newest of them.
 */
import { createContext, useContext } from 'react'
import type { ApiError } from '../api/client'

/** The datasets the backend serves today; each has a pinned screen. */
export const LIVE_DATASETS = ['generation-mix', 'system-prices'] as const
export type LiveDatasetId = (typeof LIVE_DATASETS)[number]

/** How far back to look for the latest day: the backend's widest allowed range. */
export const LATEST_LOOKBACK_DAYS = 400

/** How long to wait before asking again while gridflow holds the store for a refresh. */
export const REFRESH_RETRY_MS = 15_000

export interface LatestDay {
  /** `YYYY-MM-DD`; null when nothing is held in the lookback; undefined while being read. */
  day: string | null | undefined
  error: ApiError | null
  refresh: () => void
}

export type LatestDays = Record<LiveDatasetId, LatestDay>

export const LatestDaysContext = createContext<LatestDays | null>(null)

export function useLatestDays(): LatestDays {
  const ctx = useContext(LatestDaysContext)
  if (!ctx) throw new Error('useLatestDays outside LatestDaysProvider')
  return ctx
}

export function useLatestDay(id: LiveDatasetId): LatestDay {
  return useLatestDays()[id]
}

/** The newest day across the live datasets: undefined while any is still being read and none is known. */
export function newestDay(days: LatestDays): string | null | undefined {
  const all = LIVE_DATASETS.map((id) => days[id].day)
  const known = all.filter((d): d is string => typeof d === 'string').sort()
  if (known.length) return known[known.length - 1]
  return all.some((d) => d === undefined) ? undefined : null
}
