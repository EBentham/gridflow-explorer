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

/**
 * `/api/forecasts/variants` entry — one per distinct forecast `model_id`,
 * from its newest run (P4-forecast-screen-SPEC.md). `title` is derived
 * server-side, not stored.
 */
export interface ForecastVariant {
  model_id: string
  title: string
  vintage_kind: string
  vintage_policy_id: string
  perfect_prog_caveat: boolean
  run_id: string
  written_at: string
  gates_passed: boolean
  first_settlement_date: string
  last_settlement_date: string
  n_days: number
}

/**
 * One record from `/api/forecasts/day` — one settlement period of one
 * Variant, its quantile fan, and the realised `actual` (already on the
 * forecast row, no join needed).
 */
export interface ForecastDayRecord {
  model_id: string
  delivery_time: string
  settlement_period: number
  actual: number | null
  'q_0.05': number
  'q_0.1': number
  'q_0.25': number
  'q_0.5': number
  'q_0.75': number
  'q_0.9': number
  'q_0.95': number
}

/** One record from `/api/forecasts/metrics` — a run- or gate-scoped metric row. */
export interface ForecastMetric {
  model_id: string
  run_id: string
  metric_kind: string
  scope: string
  metric_name: string
  metric_value: number
  gate_passed: boolean | null
  gate_threshold: number | null
  gate_message: string | null
  train_size: number | null
  valid_size: number | null
  n_folds: number
  gates_passed: boolean
  perfect_prog_caveat: boolean
}
