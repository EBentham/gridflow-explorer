/**
 * The latest UK day with local data for each pinned screen's dataset, read
 * from gridflow's source list (`latest_local_day`, the anchor every dataset
 * page uses), so a pinned screen and its source page agree on it. Screens
 * anchor their default range on their own dataset's day; the rail foot shows
 * the newest of them. The source list is one cached read shared app-wide.
 */
import type { ApiError } from '../api/client'
import { httpAdapter } from '../views/_data/http'
import { useManifest } from '../views/_data/hooks'

/** Each pinned screen's dataset, as gridflow's source list names it. */
const DATASETS = { 'generation-mix': 'fuelhh', 'system-prices': 'system_prices' } as const
export type LiveDatasetId = keyof typeof DATASETS

export interface LatestDay {
  /** `YYYY-MM-DD`; null when nothing is held; undefined while being read. */
  day: string | null | undefined
  error: ApiError | null
}

export type LatestDays = Record<LiveDatasetId, LatestDay>

export function useLatestDays(): LatestDays {
  const manifest = useManifest(httpAdapter)
  // A failed re-read keeps the source list it had, so a known day stays known.
  const datasets = manifest.value?.sources.flatMap((s) => s.families.flatMap((f) => f.datasets))
  const latest = (id: LiveDatasetId): LatestDay => ({
    day: datasets ? (datasets.find((d) => d.id === DATASETS[id])?.coverage?.latest_local_day ?? null) : undefined,
    error: manifest.error,
  })
  return { 'generation-mix': latest('generation-mix'), 'system-prices': latest('system-prices') }
}

/** The newest day across the live datasets: undefined while any is still being read and none is known. */
export function newestDay(days: LatestDays): string | null | undefined {
  const all = Object.values(days).map((d) => d.day)
  const known = all.filter((d): d is string => typeof d === 'string').sort()
  if (known.length) return known[known.length - 1]
  return all.some((d) => d === undefined) ? undefined : null
}
