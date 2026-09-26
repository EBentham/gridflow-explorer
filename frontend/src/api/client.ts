import type { ApiErrorBody } from './types'

/**
 * Typed API error carrying the backend's machine-readable `code`
 * (e.g. `unknown_dataset`, `refresh_in_progress`) so screens can special-case
 * specific codes, the HTTP `status` when there was a response, and what the
 * rows endpoint adds to its envelope: why a dataset isn't held
 * (`notHeldCause`) and how to narrow a window that holds too much (`hint`).
 */
export class ApiError extends Error {
  code: string
  status?: number
  notHeldCause?: string
  hint?: string

  constructor(code: string, message: string, extra: { status?: number; notHeldCause?: string | null; hint?: string | null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = extra.status
    this.notHeldCause = extra.notHeldCause ?? undefined
    this.hint = extra.hint ?? undefined
  }
}

/**
 * Fetches JSON from `path` and throws a typed `ApiError` on a non-OK response.
 *
 * A handled backend error has the `{error: {code, message}}` envelope
 * (P1-PLAN.md "Error shape"), which the rows endpoint extends with
 * `not_held_cause` and `hint`. A genuine 500 has no such envelope, so the
 * JSON parse is guarded and falls back to the HTTP status text.
 *
 * `init` defaults every existing GET call site's behaviour unchanged; P3's
 * `useFetchJob` passes `{ method: 'POST' }` to trigger a fetch job.
 */
export async function fetchJson<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, signal })

  if (!response.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      body = null
    }

    if (body?.error) {
      throw new ApiError(body.error.code, body.error.message, {
        status: response.status,
        notHeldCause: body.error.not_held_cause,
        hint: body.error.hint,
      })
    }

    throw new ApiError('unknown_error', `${response.status} ${response.statusText}`, { status: response.status })
  }

  return (await response.json()) as T
}
