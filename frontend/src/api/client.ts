import type { ApiErrorBody } from './types'

/**
 * Typed API error carrying the backend's machine-readable `code`
 * (e.g. `unknown_dataset`, `refresh_in_progress`) so screens can special-case
 * specific codes later (P3 uses `refresh_in_progress` to poll job status).
 */
export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * Fetches JSON from `path` and throws a typed `ApiError` on a non-OK response.
 *
 * A handled backend error has the `{error: {code, message}}` envelope
 * (P1-PLAN.md "Error shape"). A genuine 500 has no such envelope, so the
 * JSON parse is guarded and falls back to the HTTP status text.
 */
export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })

  if (!response.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      body = null
    }

    if (body?.error) {
      throw new ApiError(body.error.code, body.error.message)
    }

    throw new ApiError('unknown_error', `${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}
