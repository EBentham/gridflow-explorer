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

/** One record from `/api/datasets/{id}/data`: a timestamp plus one value per series (null where none is held). */
export type DataRecord = Record<string, string | number | null>

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    /** The rows endpoint's 404 for a dataset that isn't held (`src/views/contract.ts`). */
    not_held_cause?: string | null
    /** The rows endpoint's 413: which limit the request hit. */
    reason?: string | null
    /** The rows endpoint's 413 and 422: how to narrow or fix the request. */
    hint?: string | null
    [extra: string]: unknown
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
 * `/api/forecasts/variants` entry — one per distinct `(model_id,
 * vintage_policy_id)` pair, from that pair's newest run
 * (P4-forecast-screen-SPEC.md, revised: a single `model_id` can carry more
 * than one live `vintage_policy_id` — ADR-057 secs 2-3 — so `model_id`
 * alone does not identify a Variant). `title` is derived server-side, not
 * stored.
 *
 * `perfect_prog_caveat` and `gates_passed` are **nullable**: the backend
 * derives them from a `left` join onto the metrics store
 * (`app/forecasts.py`'s `list_variants`), so a Variant with forecasts but
 * no matching metrics reports `null`, not `false`. Treat `null` as
 * "unknown" — a Sol diff review finding: reading a `null` `gates_passed`
 * as `!gates_passed` (failed) or a `null` caveat as "not applicable" is
 * silently wrong, not merely imprecise.
 */
export interface ForecastVariant {
  model_id: string
  title: string
  vintage_kind: string
  vintage_policy_id: string
  perfect_prog_caveat: boolean | null
  run_id: string
  written_at: string
  gates_passed: boolean | null
  first_settlement_date: string
  last_settlement_date: string
  n_days: number
}

/**
 * One record from `/api/forecasts/day` — one settlement period of one
 * Variant (`model_id` + `vintage_policy_id`, since either alone does not
 * identify the Variant), its quantile fan, and the realised `actual`
 * (already on the forecast row, no join needed).
 */
export interface ForecastDayRecord {
  model_id: string
  vintage_policy_id: string
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
  vintage_policy_id: string
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

/**
 * Canonical `(model_id, vintage_policy_id)` pair key: a JSON-encoded
 * 2-element array, matching the backend's `_encode_variant_key`
 * (`app/forecasts.py`) exactly -- both call their platform's standard
 * JSON encoder on the identical `[model_id, vintage_policy_id]` shape.
 *
 * A hand-picked separator (the previous `"::"`-joined string) is not
 * collision-safe: `model_id`/`vintage_policy_id` come from a different
 * repository this app only reads, so their content is not constrained by
 * anything here (Sol diff review, second confirmatory pass). If either
 * identifier ever contained the separator, two *distinct* pairs could
 * encode to the *same* string -- e.g. `("A::B", "C")` and `("A", "B::C")`
 * both joined to `"A::B::C"` -- silently merging two different Variants'
 * chart series, checkbox state, and React list keys into one. JSON's own
 * string escaping, not a delimiter choice, is what makes two different
 * pairs always produce two different encoded strings.
 *
 * This is the single definition of the pair's wire form: it is used both
 * as the value sent in each repeated `variant_key` query param and as the
 * internal `Map`/React `key=` used everywhere a Variant needs a stable
 * identity (`ForecastScreen.tsx`, `ForecastFanChart.tsx`).
 */
export function variantKey(modelId: string, vintagePolicyId: string): string {
  return JSON.stringify([modelId, vintagePolicyId])
}
