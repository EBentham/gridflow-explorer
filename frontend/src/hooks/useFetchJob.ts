import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { JobStatus } from '../api/types'
import type { DateRange } from '../lib/range'

const POLL_INTERVAL_MS = 1500
const TERMINAL_STATES: ReadonlySet<JobStatus['state']> = new Set(['succeeded', 'failed'])

interface UseFetchJobResult {
  job: JobStatus | null
  starting: boolean
  error: ApiError | null
  /** POSTs `range` as the fetch window, then polls until a terminal state. */
  start: (range: DateRange) => void
}

/**
 * Drives the P3 fetch-and-poll flow for one dataset.
 *
 * `start(range)` POSTs the requested range as-is — no gap-stitching logic.
 * Re-requesting already-present days is safe for the explorer specifically
 * (not because gridflow's re-fetch is idempotent — it is not): duplicate
 * silver rows are tolerated at read time by `transforms.load_generation_mix`
 * (dedup before aggregation), the vintage-collapsed
 * `silver_elexon_system_prices_latest` view, and coverage's distinct-date
 * counting (P3-PLAN.md T4 action 4, reasons (a)/(b)/(c)).
 *
 * A 409 (`refresh_in_progress`) from the POST is not surfaced as an error —
 * a job is already running (ours or another tab's), so this switches
 * straight into polling mode, same as a fresh 202 would.
 *
 * Polling uses a self-scheduling `setTimeout` chain, never a bare
 * `setInterval`, so a slow tick cannot overlap the next one
 * (P3-PLAN.md case 15). Polling stops on a terminal state and on unmount;
 * in-flight requests are aborted on cleanup, matching `useDataset`'s
 * `AbortController` pattern.
 */
export function useFetchJob(datasetId: string): UseFetchJobResult {
  const [job, setJob] = useState<JobStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const timeoutRef = useRef<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const stopPolling = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const poll = useCallback(() => {
    const controller = new AbortController()
    controllerRef.current = controller

    fetchJson<JobStatus>('/api/jobs/current', controller.signal)
      .then((status) => {
        if (!mountedRef.current || controller.signal.aborted) return
        setJob(status)
        if (!TERMINAL_STATES.has(status.state)) {
          timeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!mountedRef.current) return
        // A transient poll failure (e.g. a 503 mid-refresh) should not kill
        // the flow — the job is still running server-side; keep polling.
        timeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
      })
  }, [])

  const start = useCallback(
    (range: DateRange) => {
      stopPolling()
      setStarting(true)
      setError(null)

      const controller = new AbortController()
      controllerRef.current = controller

      const path = `/api/datasets/${datasetId}/fetch?start=${range.start}&end=${range.end}`
      fetchJson<JobStatus>(path, controller.signal, { method: 'POST' })
        .then((status) => {
          if (!mountedRef.current || controller.signal.aborted) return
          setJob(status)
          timeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (!mountedRef.current) return
          if (err instanceof ApiError && err.code === 'refresh_in_progress') {
            // Not an error: a job (ours or another tab's) is already running.
            poll()
            return
          }
          setError(err instanceof ApiError ? err : new ApiError('unknown_error', String(err)))
        })
        .finally(() => {
          if (mountedRef.current) setStarting(false)
        })
    },
    [datasetId, poll, stopPolling],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  return { job, starting, error, start }
}
