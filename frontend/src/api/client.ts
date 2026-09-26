import type { ApiErrorBody } from './types'

/**
 * Typed API error carrying the backend's machine-readable `code`
 * (e.g. `unknown_dataset`, `refresh_in_progress`) so screens can special-case
 * specific codes, the HTTP `status` when there was a response, and what the
 * rows endpoint adds to its envelope: why a dataset isn't held
 * (`notHeldCause`), which limit a 413 hit (`reason`), how to narrow the
 * request (`hint`), and any other fields (`detail`, e.g. an
 * `ambiguous_series` error's `varying_dimensions`).
 */
export class ApiError extends Error {
  code: string
  status?: number
  notHeldCause?: string
  reason?: string
  hint?: string
  detail: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    extra: { status?: number; notHeldCause?: string | null; reason?: string | null; hint?: string | null; detail?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = extra.status
    this.notHeldCause = extra.notHeldCause ?? undefined
    this.reason = extra.reason ?? undefined
    this.hint = extra.hint ?? undefined
    this.detail = extra.detail ?? {}
  }
}

/**
 * Fetches JSON from `path` and throws a typed `ApiError` on a non-OK response.
 *
 * A handled backend error has the `{error: {code, message}}` envelope
 * (P1-PLAN.md "Error shape"), which the rows endpoint extends with
 * `not_held_cause`, `reason`, `hint` and more. A genuine 500 has no such envelope, so the
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
      const { code, message, not_held_cause, reason, hint, ...detail } = body.error
      throw new ApiError(code, message, { status: response.status, notHeldCause: not_held_cause, reason, hint, detail })
    }

    throw new ApiError('unknown_error', `${response.status} ${response.statusText}`, { status: response.status })
  }

  return (await response.json()) as T
}
