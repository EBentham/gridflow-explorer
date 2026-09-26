import { useEffect, useRef } from 'react'
import { listText } from '../design/format'
import { fmtDay } from '../design/time'
import { useCoverage } from '../hooks/useCoverage'
import { useFetchJob } from '../hooks/useFetchJob'
import type { DateRange } from '../lib/range'

interface FetchBannerProps {
  datasetId: string
  /** The publisher gridflow fetches from, for the button: "Elexon". */
  source: string
  range: DateRange
  onComplete: () => void
}

const LISTED_DAYS = 5

/** `Fri 18 Sep, Sat 19 Sep and Sun 20 Sep`: up to five missing days, else nothing. */
function missingText(dates: string[]): string {
  return dates.length > LISTED_DAYS ? '' : listText(dates.map(fmtDay))
}

/**
 * Coverage-driven fetch for the two live datasets: says how much of `range`
 * isn't held locally, offers to fetch it through gridflow, and reports the
 * job until it lands. Owns its own coverage read and job hook; the screen
 * passes `onComplete` (its own reload), called once the job succeeds, or
 * lands back at `idle` mid-poll (a vanished job is still worth reloading
 * against). Coverage is re-read on the same edge.
 *
 * Key it on the range (`key={range.start + range.end}`) so a range change
 * remounts it instead of showing a previous range's job state.
 */
export function FetchBanner({ datasetId, source, range, onComplete }: FetchBannerProps) {
  const { coverage, loading: coverageLoading, refetch: refetchCoverage } = useCoverage(datasetId, range)
  const { job, starting, error, start } = useFetchJob(datasetId)

  const prevStateRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    // `idle` reached while a job was being tracked means it vanished server
    // side rather than succeeding or failing: finished with an unknown
    // outcome. Reload the same as for `succeeded`. `job` starts null, never
    // a made-up `idle`, so this fires only on a transition seen by polling.
    const isCompletion =
      (job?.state === 'succeeded' && prevStateRef.current !== 'succeeded') || (job?.state === 'idle' && prevStateRef.current !== 'idle')
    if (isCompletion) {
      refetchCoverage()
      onComplete()
    }
    prevStateRef.current = job?.state
  }, [job?.state, onComplete, refetchCoverage])

  if (starting || job?.state === 'running') {
    return (
      <div className="gf-coverage" role="status">
        Fetching from {source} through gridflow. The chart reloads when the job finishes.
      </div>
    )
  }

  if (job?.state === 'succeeded' && coverageLoading) {
    return (
      <div className="gf-coverage" role="status">
        The fetch finished. Reading the new rows.
      </div>
    )
  }

  if (job?.state === 'failed') {
    return (
      <div className="gf-coverage is-failed" role="alert">
        The fetch failed: {job.message ?? 'gridflow gave no reason'}
      </div>
    )
  }

  if (error) {
    return (
      <div className="gf-coverage is-failed" role="alert">
        Couldn't start the fetch: {error.message}
      </div>
    )
  }

  if (!coverage || coverage.missing_day_count === 0) return null

  const listed = missingText(coverage.missing_dates)
  return (
    <div className="gf-coverage" role="status">
      <span>
        {coverage.missing_day_count} of {coverage.requested_day_count} days in this range aren't held locally{listed ? `: ${listed}` : ''}.
      </span>
      <button type="button" onClick={() => start(range)}>
        Fetch them from {source}
      </button>
    </div>
  )
}
