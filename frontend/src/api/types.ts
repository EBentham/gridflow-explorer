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
