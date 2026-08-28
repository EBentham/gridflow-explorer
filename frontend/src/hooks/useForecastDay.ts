import { useEffect, useState } from 'react'
import { ApiError, fetchJson } from '../api/client'
import type { ForecastDayRecord } from '../api/types'

interface UseForecastDayResult {
  data: ForecastDayRecord[] | null
  loading: boolean
  error: ApiError | null
}

/** Whether the current `(date, variantKeys)` should skip fetching entirely. */
function shouldSkip(date: string | null, variantKeys: string[]): boolean {
  return !date || variantKeys.length === 0
}

/**
 * Fetches `/api/forecasts/day` for `date`, restricted to `variantKeys`
 * (`variantKey(model_id, vintage_policy_id)` pairs, sent as repeated
 * `variant_key` query params -- the backend validates and filters on the
 * exact pair, so no client-side re-filtering is needed here).
 *
 * Two states short-circuit the fetch entirely and resolve to `data: []`,
 * `loading: false`:
 *   - `date` is `null` -- the caller (e.g. `ForecastScreen`) is still
 *     resolving the default day from `/variants`.
 *   - `variantKeys` is empty -- the caller has explicitly deselected every
 *     Variant. This does **not** mean "every Variant" (a real defect,
 *     caught by Sol diff review: unchecking every checkbox used to still
 *     fetch and render everything, contradicting the screen's own
 *     controls).
 *
 * These two skip states and "a request is in flight" are kept genuinely
 * distinct (Sol diff review, second confirmatory pass, on the *previous*
 * version of this fix): a naive `useEffect`-only implementation computes
 * the skip decision and calls `setLoading`/`setData` **inside** the
 * effect, which only runs *after* React has already painted the current
 * render. On the render where `date`/`variantKeys` first become non-empty
 * (e.g. the instant `/variants` resolves), that render would therefore
 * still show the *previous* render's `loading`/`data` -- a stale `[]`
 * result -- painting "no forecast" for one frame before the effect fires
 * and starts the real fetch. This hook instead recomputes and resets
 * `data`/`loading` synchronously *during render* whenever `date` or the
 * JSON-encoded `variantKeys` change, using React's documented
 * "adjusting state when a prop changes" pattern: calling `setState`
 * directly in the render body (not inside an effect or callback) is safe
 * and causes React to re-render immediately, before anything is painted,
 * so there is no visible stale frame.
 *
 * `variantKeys` is compared/passed via `JSON.stringify`/`JSON.parse`
 * rather than joining with a separator (e.g. `.join(',')`) for the same
 * reason `variantKey()` itself moved off `"::"`-joining a pair: a
 * `variantKey(...)` value is itself a JSON string and can legitimately
 * contain a comma, so a comma-joined list of keys is not guaranteed to
 * split back into the original keys.
 */
export function useForecastDay(date: string | null, variantKeys: string[]): UseForecastDayResult {
  const variantKeysJson = JSON.stringify(variantKeys)
  const skip = shouldSkip(date, variantKeys)

  const [data, setData] = useState<ForecastDayRecord[] | null>(() => (skip ? [] : null))
  const [loading, setLoading] = useState(() => !skip)
  const [error, setError] = useState<ApiError | null>(null)
  const [committedDate, setCommittedDate] = useState(date)
  const [committedKeysJson, setCommittedKeysJson] = useState(variantKeysJson)

  if (committedDate !== date || committedKeysJson !== variantKeysJson) {
    setCommittedDate(date)
    setCommittedKeysJson(variantKeysJson)
    setData(skip ? [] : null)
    setLoading(!skip)
    setError(null)
  }

  useEffect(() => {
    // Re-derived from the effect's own dependencies (not closed over from
    // the render above) so the effect is self-contained and its
    // dependency array is complete.
    const keys = JSON.parse(variantKeysJson) as string[]
    if (!date || keys.length === 0) return undefined

    const controller = new AbortController()

    const params = new URLSearchParams({ date })
    for (const key of keys) params.append('variant_key', key)
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
  }, [date, variantKeysJson])

  return { data, loading, error }
}
