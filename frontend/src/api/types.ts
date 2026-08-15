/**
 * Types mirroring the backend's JSON shapes exactly (P1-PLAN.md "API contract").
 * Field names are snake_case to match the wire format one-for-one — no mapping
 * layer between backend and frontend.
 */

export interface SeriesSpec {
  key: string
  label: string
}

export interface DatasetSummary {
  id: string
  title: string
  description: string
  chart: string
  unit: string
  default_range_days: number
  timestamp_key: string
  series: SeriesSpec[]
}

/** One record from `/api/datasets/{id}/data` — a timestamp plus one value per series. */
export type DataRecord = Record<string, string | number>

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

/** `/api/datasets/{id}/coverage` response — P3-PLAN.md's coverage shape. */
export interface Coverage {
  dataset_id: string
  requested: { start: string; end: string }
  present_dates: string[]
  missing_dates: string[]
  missing_day_count: number
  requested_day_count: number
}

/**
 * The one job shape returned by both `POST .../fetch` (202 body) and
 * `GET /api/jobs/current` (P3-PLAN.md T3: "a superset of P1-PLAN's 202
 * body ... a deliberate simplification so the frontend has exactly one job
 * type"). Only `state` is guaranteed present — a fresh manager with no job
 * ever started answers the bare `{"state": "idle"}`.
 */
export interface JobStatus {
  state: 'idle' | 'running' | 'succeeded' | 'failed'
  job_id?: string
  dataset_id?: string
  started_at?: string
  finished_at?: string | null
  message?: string | null
}
