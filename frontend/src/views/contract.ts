/**
 * The data contract between the Explorer's dataset pages and the backend,
 * snake_case so the wire maps one-for-one with no translation layer:
 *
 * - `Manifest` is `GET /api/sources` (v0.4 P3-1): every source, family and
 *   dataset gridflow knows, with what is held locally.
 * - `RowsResponse` is `GET /api/sources/{source}/{dataset}/rows` (v0.4 P3-2):
 *   one held dataset's rows for a window of UK days.
 * - `DataSource` is what a page reads through: `_data/http.ts` reads the
 *   two endpoints (every page's default), and the fixture adapter
 *   (`_data/fixture.ts`), kept for the template's demo page, returns
 *   exactly the same shapes.
 *
 * P3 returns shapes that map onto these types; change one only with the
 * other. Free-text fields (grain, unit, notes, causes) are typed as strings
 * on purpose: they are research output, and pages must not parse them.
 */

// ---------------------------------------------------------------- manifest

export type Domain = 'Electricity' | 'Gas' | 'Weather'

/** How a dataset's rows are shaped, decided by its table's key (DESIGN §7). */
export type Kind = 'series' | 'events' | 'reference'

/**
 * What the Explorer does with a family: `build` and `table-only` get a page
 * under `src/views/<source>/<slug>/`; `pinned` and `external` open an
 * existing screen (`route`); `not-built` is listed on its source page only.
 */
export type FamilyPage = 'build' | 'table-only' | 'not-built' | 'pinned' | 'external'

export interface Manifest {
  /** When the backend last read coverage from the local store, ISO 8601 UTC. */
  generated_at: string
  /** Today's UK date (`YYYY-MM-DD`) when the response was made; every `latest_local_day` is capped at it. */
  today_uk: string
  sources: ManifestSource[]
}

export interface ManifestSource {
  /** gridflow's source key, e.g. `elexon`; the first path segment of a page route. */
  key: string
  name: string
  domain: Domain
  /** `gold` for gridflow's own derived tables, `silver` for a publisher's data. */
  layer: 'silver' | 'gold'
  host: string
  blurb: string
  families: ManifestFamily[]
}

export interface ManifestFamily {
  /** Kebab case of `label`, unique within its source: the page's folder and route segment. */
  slug: string
  label: string
  kind: Kind
  page: FamilyPage
  /** `/sources/<key>/<slug>` for build and table-only, the screen's path for pinned and external, null when not built. */
  route: string | null
  /** Research notes: internal references, never shown as they stand (see `ManifestDataset.notes`). */
  notes: string[]
  datasets: ManifestDataset[]
}

export interface DatasetClock {
  /** The column holding each row's time; null when the table has none (registers). */
  column: string | null
  /**
   * The cadence as researched: `30min`, `1d`, `event`, `snapshot`,
   * `mixed (PT15M, PT60M)`, … Free text for people. The rows response's
   * `grain_ms` is the machine-readable grain.
   */
  grain: string | null
  /** `settlement_date` / `settlement_period` where the table carries them. gridflow owns their meaning. */
  settlement_cols: string[]
}

export interface LatestDayRule {
  /** `max`: the latest local day is the UK date of `max(column)`, capped at today. */
  mode: 'max' | 'reference' | 'unknown'
  column: string | null
}

export interface ValueColumn {
  column: string
  /**
   * As researched: `MW`, `GBP/MWh`, `degC`, `gCO2/kWh`, … and sometimes a
   * sentence (`per the paired _unit column`). Null when unconfirmed: the page
   * says so rather than guessing. Display it through `displayUnit()`.
   */
  unit: string | null
  /** A research description, not a display label: pages name columns themselves. */
  label: string
}

export interface Dim {
  column: string
  /** `series`: one line or band per value; `filter`: narrows the rows. */
  role: 'series' | 'filter'
  /** Distinct values measured by the research; a string (`unknown`) or null where it wasn't. */
  cardinality: number | string | null
}

/** A structured equality filter, never SQL text. */
export interface EqualsFilter {
  column: string
  equals: string | number | boolean
}

export interface DatasetCoverage {
  /** Rows held, after the dataset's dedup and mandatory row filter. */
  rows: number
  /** First and last UK day of the clock column; null for reference tables. */
  first_day: string | null
  last_day: string | null
  /** Distinct UK days holding at least one row. A covered day is not necessarily complete. */
  day_count: number | null
  /**
   * The UK day a page's default window ends on: the last UK day of the
   * dataset's window column (the column the rows endpoint windows on, never
   * a planned or delivery clock), capped at today (RULINGS #17). Can be a
   * stub day holding a few rows. Null for reference tables and when unknown.
   */
  latest_local_day: string | null
  /** Reference tables only: when gridflow last wrote the table, ISO 8601 UTC. */
  last_ingested?: string | null
}

export interface ManifestDataset {
  id: string
  /** How often gridflow fetches it (`hourly`, `daily`, …); null for gold. */
  schedule: string | null
  kind: Kind
  /** The research verdict: `chart`, `events-table`, `reference-table`, `not-held`, `broken`. */
  verdict: string
  clock: DatasetClock | null
  latest_day_rule: LatestDayRule
  values: ValueColumn[]
  dims: Dim[]
  /** Applied by the backend when a request names no filter. */
  default_filter: EqualsFilter | null
  volume_class: 'small' | 'medium' | 'large' | null
  /**
   * Research notes with internal references (file lines, rulings, "silver").
   * Never rendered as they stand: a page reads them, and the P1 card, and
   * writes its own plain-words `caveats`.
   */
  notes: string[]
  /** Whether the local store holds it. False means no relation, no coverage and no rows. */
  held: boolean
  /** The table the backend reads; null when not held. */
  relation: string | null
  /**
   * Why it isn't held: a prefix (`never-fetched`, `fetched-empty`,
   * `missing-in-catalogue`, `current-only`, `no-transformer`,
   * `folded-into:<relation>`) with a research tail. Show `notHeldText()`, not this.
   */
  not_held_cause: string | null
  coverage: DatasetCoverage | null
}

// ---------------------------------------------------------------- rows

export interface RowsQuery {
  /**
   * The window as inclusive UK dates. Omit both for the backend's default,
   * the 7 days ending on the latest local day. Never sent for reference tables.
   */
  start?: string
  end?: string
  /** A `dims` column. Series default to the first dim whose role is `series`. */
  group?: string
  /**
   * Equality filters on `dims` columns (`filter=<column>:<value>`, repeated).
   * Undefined: the dataset's `default_filter` applies. Null: clear it (sent
   * as an empty `filter=`).
   */
  filters?: Record<string, string> | null
}

/** A cell as it comes off the wire. Other timestamps than `ts` arrive as UTC ISO strings, dates as `YYYY-MM-DD`. */
export type Scalar = string | number | boolean | null

/**
 * A series row, long format: one per (`ts`, group value). `ts` is epoch ms
 * UTC; a DATE clock (gas day, measurement date) arrives as that date at UTC
 * midnight, a date coordinate rather than an instant. Missing grid steps come
 * as rows with null values, never zeros.
 *
 * Besides `ts` and the value columns a row carries more keys than `columns`
 * names: the table's clock column as it is held (an ISO string, e.g.
 * `timestamp_utc`), its `dims` and its dedup keys. They are typed by the
 * index signature and read only where a page names them.
 */
export interface SeriesRow {
  ts: number
  /** Only where the table has them; gridflow owns settlement-period semantics, so never derive these. */
  settlement_date?: string | null
  settlement_period?: number | null
  [column: string]: Scalar | undefined
}

/**
 * An event: its time (epoch ms UTC, the dataset's window column, e.g.
 * `published_at`) plus its fields, the clock column as held among them.
 */
export interface EventRow {
  ts: number
  [field: string]: Scalar | undefined
}

/**
 * A reference row: a plain record, no clock. The backend adds a `ts` from
 * the table's time column when it has one (an ingest time, say); the HTTP
 * adapter drops that `ts`, and the column itself stays.
 */
export type ReferenceRow = Record<string, Scalar>

export interface RowsWindow {
  /** Inclusive UK dates. */
  start: string
  end: string
  tz: 'Europe/London'
}

export interface RowsCoverage {
  /** The dataset's local depth on this endpoint's clock. */
  first_day: string | null
  last_day: string | null
  /** As the manifest's: the window column's last UK day, capped at today. The default window ends on it. */
  latest_local_day: string | null
  /** Inclusive days in the requested window; null for reference tables. */
  days_in_window: number | null
}

/** Why a response came back cut down or changed (P3-2 PLAN §7); every reason that applies is reported. */
export type TruncationType = 'default_filter' | 'default_top_n' | 'exact_duplicate_rows' | 'downsample' | 'deep_range' | 'ancillary_null'

/** One reason fewer rows came back than the window holds, or came back changed. Pages show it through `truncationSentences()`. */
export interface TruncationReason {
  type: TruncationType | (string & {})
  /**
   * `default_filter` and `default_top_n`: records the default left out. A
   * default filter's column and value are the dataset's `default_filter`.
   */
  omitted_rows?: number
  /** `default_top_n`: what was kept, in words (`top 20 units by mean notified end level`). */
  label?: string
  /** `default_top_n`: the group values kept, and how many were left out. */
  selected_ids?: string[]
  omitted_groups?: number
  /** `default_top_n`: rows naming no unit, left out of the ranking. */
  excluded_null_unit_rows?: number
  /** `exact_duplicate_rows`: records that repeated another exactly, shown once. */
  removed_rows?: number
  /** `downsample`: the bucket width. */
  bucket_ms?: number
  /** `ancillary_null`: text or flag columns that vary within a bucket, left blank in the means (the shape is inferred from P3-2 PLAN §7). */
  columns?: string[]
  [detail: string]: unknown
}

export interface Truncation {
  /** The most rows one response carries. */
  row_cap: number
  reasons: TruncationReason[]
  rows_before_defaults: number | null
  rows_after_filters: number | null
  returned_rows: number
  /** Set when rows are time-bucket means: each row's `ts` starts a bucket this wide (UTC-aligned). */
  bucket_ms: number | null
  aggregation: string | null
}

interface RowsResponseBase {
  dataset: string
  source: string
  /** The table actually read. */
  relation: string
  /** The resolved window; null for reference tables. */
  window: RowsWindow | null
  /** The regular step in ms (1 800 000 for half-hourly); null for mixed, irregular and event clocks. */
  grain_ms: number | null
  /** The value columns, as in the manifest (units preserved, null when unconfirmed). */
  columns: ValueColumn[]
  /** The dim rows are split by; null when ungrouped. */
  group: string | null
  /** The equality filters actually applied, defaults included. */
  filters: Record<string, Scalar>
  row_count: number
  /** True whenever a cap, a downsample or a default reduced what came back. Never silent: show it. */
  truncated: boolean
  truncation: Truncation | null
  coverage: RowsCoverage
  /** Plain-words caveats from the backend (date coordinates, downsampling, cadence). */
  notes: string[]
}

export interface SeriesRowsResponse extends RowsResponseBase {
  kind: 'series'
  rows: SeriesRow[]
}

export interface EventsRowsResponse extends RowsResponseBase {
  kind: 'events'
  /** Newest first. */
  rows: EventRow[]
}

export interface ReferenceRowsResponse extends RowsResponseBase {
  kind: 'reference'
  rows: ReferenceRow[]
}

export type RowsResponse = SeriesRowsResponse | EventsRowsResponse | ReferenceRowsResponse

/**
 * The error envelope (P3-2 PLAN §7). Besides the codes every route shares
 * (`refresh_in_progress` 503, `catalogue_missing` 503), the rows endpoint
 * answers:
 *
 * - 404 `unknown_dataset`: an unknown dataset, or one that isn't held (with
 *   `not_held_cause`);
 * - 422 `bad_range`, `bad_filter`, `bad_group`, `bad_identifier`,
 *   `window_unavailable`, and `ambiguous_series` (with `group`,
 *   `varying_dimensions`, `varying_keys` and `varying_columns`, and a `hint`
 *   that is a query string, never shown as it stands);
 * - 413 `result_too_large` with a `reason` (`row_cap`, `unsafe_downsample`,
 *   `unsupported_cadence`, …) and a plain-words `hint` on narrowing the request.
 */
export interface RowsErrorBody {
  error: {
    code: string
    message: string
    not_held_cause?: string | null
    reason?: string | null
    hint?: string | null
    [extra: string]: unknown
  }
}

// ---------------------------------------------------------------- the adapter

export interface RowsRequest extends RowsQuery {
  source: string
  dataset: string
}

/**
 * Where a page's data comes from. Both methods reject with `ApiError`
 * (`src/api/client.ts`), carrying the envelope's code, the HTTP status, any
 * `not_held_cause`, `reason` or `hint`, and the envelope's other fields.
 */
export interface DataSource {
  /**
   * `fixture` data is synthetic: every panel drawing it carries the
   * dashed-ochre Fixture tag (DESIGN §9). `live` reads the local store.
   */
  readonly origin: 'fixture' | 'live'
  manifest(signal?: AbortSignal): Promise<Manifest>
  rows(request: RowsRequest, signal?: AbortSignal): Promise<RowsResponse>
}
