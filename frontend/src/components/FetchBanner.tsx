import { useEffect, useRef } from 'react'
import type { DatasetSummary } from '../api/types'
import { useCoverage } from '../hooks/useCoverage'
import { useFetchJob } from '../hooks/useFetchJob'
import type { DateRange } from '../lib/range'

interface FetchBannerProps {
  dataset: DatasetSummary
  range: DateRange
  onComplete: () => void
}

/**
 * Coverage-driven fetch affordance: reports how much of `range` is missing
 * locally, offers a button to fetch it, and shows calm state through the
 * P3 job lifecycle. Owns its own `useCoverage`/`useFetchJob` — the screen
 * need only render it and pass `onComplete` (the screen's own data
 * refetch), called once the job succeeds or lands back at `idle`
 * mid-poll (finished-with-unknown-outcome — a vanished job is still worth
 * refreshing against); this component refetches its own coverage on the
 * same edge.
 *
 * Callers should key this component on the range (`key={range.start +
 * range.end}`) so a range change remounts it, resetting any stale job
 * state from a previous range's fetch rather than showing it against the
 * new one.
 */
export function FetchBanner({ dataset, range, onComplete }: FetchBannerProps) {
  const {
    coverage,
    loading: coverageLoading,
    refetch: refetchCoverage,
  } = useCoverage(dataset.id, range)
  const { job, starting, error, start } = useFetchJob(dataset.id)

  const prevStateRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    // `idle` reached while a job was being tracked (mount-discovered or
    // self-started) means the job vanished server-side rather than
    // succeeding or failing outright — finished-with-unknown-outcome. Treat
    // it the same as `succeeded` for the refetch: no error wall, just pick
    // up whatever landed. `job` starts `null`, never a fabricated `idle`, so
    // this only fires on a genuine transition observed via polling.
    const isCompletion =
      (job?.state === 'succeeded' && prevStateRef.current !== 'succeeded') ||
      (job?.state === 'idle' && prevStateRef.current !== 'idle')
    if (isCompletion) {
      refetchCoverage()
      onComplete()
    }
    prevStateRef.current = job?.state
  }, [job?.state, onComplete, refetchCoverage])

  if (starting || job?.state === 'running') {
    return (
      <div className="fetch-banner fetch-banner-running" role="status">
        Fetching missing {dataset.title.toLowerCase()} data…
      </div>
    )
  }

  if (job?.state === 'succeeded' && coverageLoading) {
    return (
      <div className="fetch-banner fetch-banner-running" role="status">
        Fetch complete — refreshing…
      </div>
    )
  }

  if (job?.state === 'failed') {
    return (
      <div className="fetch-banner fetch-banner-failed" role="alert">
        Fetch failed: {job.message ?? 'unknown error'}
      </div>
    )
  }

  if (error) {
    return (
      <div className="fetch-banner fetch-banner-failed" role="alert">
        Fetch failed: {error.message}
      </div>
    )
  }

  if (!coverage || coverage.missing_day_count === 0) {
    return null
  }

  return (
    <div className="fetch-banner fetch-banner-idle">
      <span>
        {coverage.missing_day_count} of {coverage.requested_day_count} days missing locally
      </span>
      <button type="button" onClick={() => start(range)}>
        Fetch missing data
      </button>
    </div>
  )
}
